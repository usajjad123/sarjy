"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { context, type Workspace } from "@/features/food-logging/model";
import { localDate } from "@/features/nutrition/engine";
import { useSarjy } from "@/hooks/use-sarjy";
import { loadWorkspace } from "@/lib/load-workspace";
import type { VoiceEvent } from "@/lib/realtime/types";
import { actionLabels, savedChangeLabels } from "./action-labels";
import type { FoodAction } from "./types";

export function useDiaryWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const current = useRef<Workspace | null>(null);
  const mutationInFlight = useRef(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [storage, setStorage] = useState("");
  const [status, setStatus] = useState("");
  const [lookup, setLookup] = useState("");
  const [change, setChange] = useState<{ name: string; version: number } | null>(null);

  const accept = useCallback((next: Workspace) => {
    if (current.current && next.version < current.current.version) return;
    current.current = next;
    setWorkspace(next);
  }, []);
  const onVoice = useCallback(
    (event: Extract<VoiceEvent, { type: "workspace" }>) => {
      accept(event.workspace);
      if (event.action) {
        setStatus(
          savedChangeLabels[event.action] || actionLabels[event.action] || "Records updated",
        );
        if (savedChangeLabels[event.action])
          setChange({ name: event.action, version: event.workspace.version });
      }
    },
    [accept],
  );
  const voice = useSarjy(onVoice);

  useEffect(() => {
    let alive = true;
    loadWorkspace(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((body) => {
        if (!alive) return;
        accept(body.workspace);
        setDate(localDate(body.workspace.timezone));
        setLookup(String(body.foodLookup));
        setStorage(String(body.storage));
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : "Could not load records.");
      });
    return () => {
      alive = false;
    };
  }, [accept]);

  const runAction: FoodAction = async (name, args) => {
    if (!current.current || mutationInFlight.current) return null;
    mutationInFlight.current = true;
    setBusy(name);
    setError("");
    try {
      const response = await fetch("/api/food-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          args,
          expectedVersion: current.current.version,
          callId: crypto.randomUUID(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          const fresh = await fetch("/api/workspace", { cache: "no-store" }).then((result) =>
            result.json(),
          );
          if (fresh.workspace) {
            accept(fresh.workspace);
            voice.sync(fresh.workspace);
          }
        }
        throw new Error(body.error || "Could not save your records.");
      }
      accept(body.workspace);
      voice.sync(body.workspace);
      if (savedChangeLabels[name]) setChange({ name, version: body.workspace.version });
      setStatus(
        name === "commit_food_log"
          ? "Meal logged. Your totals are up to date."
          : name === "undo"
            ? "Last change undone."
            : body.workspace.pending
              ? "Draft saved. Intake updates once you log the meal."
              : "Saved to your records.",
      );
      return body.workspace;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save. Read current records before retrying.",
      );
      return null;
    } finally {
      mutationInFlight.current = false;
      setBusy("");
    }
  };
  const today = workspace ? localDate(workspace.timezone) : "";
  const summary = workspace ? context(workspace, date || today) : null;
  return {
    workspace,
    date,
    setDate,
    today,
    summary,
    error,
    clearError: () => setError(""),
    busy,
    status,
    storage,
    lookup,
    voice,
    change,
    runAction,
  };
}
