"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue } from "motion/react";
import { GeminiLiveProvider } from "@/lib/realtime/gemini/GeminiLiveProvider";
import type { VoiceCaption, VoiceEvent, VoiceState } from "@/lib/realtime/types";
import type { Workspace } from "@/features/food-logging/model";
export type Transcript = { role: "user" | "assistant"; text: string; complete: boolean };
export function useSarjy(onWorkspace: (event: Extract<VoiceEvent, { type: "workspace" }>) => void) {
  const provider = useRef<GeminiLiveProvider | null>(null);
  const attempt = useRef(0);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [caption, setCaption] = useState<VoiceCaption | null>(null);
  const [captionStatus, setCaptionStatus] = useState<"live" | "delayed" | "off">("off");
  const [error, setError] = useState("");
  const [mic, setMic] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [tool, setTool] = useState("");
  const [speaking, setSpeaking] = useState({ user: false, assistant: false });
  const userLevel = useMotionValue(0),
    assistantLevel = useMotionValue(0);
  const connected = ["listening", "thinking", "speaking"].includes(state);
  useEffect(() => {
    const instance = new GeminiLiveProvider();
    provider.current = instance;
    const unsubscribe = instance.onEvent((event) => {
      if (event.type === "audio_level")
        (event.speaker === "user" ? userLevel : assistantLevel).set(event.level);
      else if (event.type === "speech_activity")
        setSpeaking((previous) => ({ ...previous, [event.speaker]: event.active }));
      else if (event.type === "microphone") setMic(event.enabled);
      else if (event.type === "caption") setCaption(event.caption);
      else if (event.type === "caption_status") setCaptionStatus(event.status);
      else if (event.type === "state") setState(event.state);
      else if (event.type === "error") setError(event.error.message);
      else if (event.type === "workspace") onWorkspace(event);
      else if (event.type === "tool_state") setTool(event.busy ? event.name : "");
      else if (event.type === "turn_complete")
        setTranscript((previous) => previous.map((item) => ({ ...item, complete: true })));
      else if (event.type === "user_transcript" || event.type === "assistant_transcript")
        setTranscript((previous) => {
          const role = event.type === "user_transcript" ? "user" : "assistant";
          const last = previous.at(-1);
          return last?.role === role && !last.complete
            ? [...previous.slice(0, -1), { ...last, text: last.text + event.text }]
            : [...previous, { role, text: event.text, complete: false }];
        });
    });
    return () => {
      unsubscribe();
      instance.disconnect();
      provider.current = null;
    };
  }, [onWorkspace, userLevel, assistantLevel]);
  const start = async (voice: boolean) => {
    const current = ++attempt.current,
      instance = provider.current;
    if (!instance) return;
    setError("");
    setTranscript([]);
    await instance.connect();
    if (
      current !== attempt.current ||
      provider.current !== instance ||
      !instance.isConnected ||
      !voice
    )
      return;
    setMicBusy(true);
    try {
      await instance.setMicrophoneEnabled(true);
    } catch {
      if (current === attempt.current) setError("Allow microphone access to talk, or type below.");
    } finally {
      if (current === attempt.current) setMicBusy(false);
    }
  };
  const end = () => {
    attempt.current++;
    provider.current?.disconnect();
    setMicBusy(false);
  };
  const toggleMic = async () => {
    const current = attempt.current;
    setMicBusy(true);
    setError("");
    try {
      await provider.current?.setMicrophoneEnabled(!mic);
    } catch {
      if (current === attempt.current)
        setError("Microphone unavailable. Check your browser permission.");
    } finally {
      if (current === attempt.current) setMicBusy(false);
    }
  };
  const send = async (text: string) => {
    if (!text.trim() || state === "connecting" || micBusy) return false;
    if (!connected) await start(false);
    if (!provider.current?.isConnected) return false;
    provider.current.sendText(text);
    return true;
  };
  const sync = useCallback(
    (workspace: Workspace) => provider.current?.syncWorkspace(workspace),
    [],
  );
  return {
    state,
    transcript,
    caption,
    captionStatus,
    error,
    mic,
    micBusy,
    tool,
    speaking,
    userLevel,
    assistantLevel,
    connected,
    start,
    end,
    toggleMic,
    send,
    sync,
  };
}
