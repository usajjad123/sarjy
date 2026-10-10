import "server-only";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverSupabase, supabaseConfigured } from "@/lib/supabase/server";
import { applyAction, emptyWorkspace, type Action, type Workspace } from "./model";
import { NutritionError } from "../nutrition/engine";
import * as local from "./local-store";
type Owner = { id: string; client?: SupabaseClient; legacyId?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// During migration, concurrent requests bearing the same old browser identity
// must receive the same new session. Keep this bounded and short-lived; never
// log these tokens. Normal authenticated requests do not use this cache.
const bootstraps = new Map<string, { expires: number; session: Promise<Session> }>();
async function anonymousSession(client: SupabaseClient, legacyId?: string) {
  for (const [key, entry] of bootstraps) if (entry.expires <= Date.now()) bootstraps.delete(key);
  const cached = legacyId ? bootstraps.get(legacyId) : undefined;
  if (cached) {
    const session = await cached.session;
    const restored = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (restored.error || !restored.data.session)
      throw new NutritionError("Your private session could not be restored. Please reload.", 503);
    return restored.data.session;
  }
  const session = client.auth.signInAnonymously().then((signed) => {
    if (signed.error || !signed.data.session)
      throw new NutritionError(
        signed.error?.code === "anonymous_provider_disabled"
          ? "Enable anonymous sign-ins in Supabase Auth to start tracking."
          : "Supabase could not create your private session. Please try again shortly.",
        503,
      );
    return signed.data.session;
  });
  if (legacyId) {
    if (bootstraps.size >= 128) bootstraps.delete(bootstraps.keys().next().value!);
    bootstraps.set(legacyId, { expires: Date.now() + 120_000, session });
    session.catch(() => {
      if (bootstraps.get(legacyId)?.session === session) bootstraps.delete(legacyId);
    });
  }
  return session;
}
export const storageKind = () => (supabaseConfigured() ? "supabase" : "local");
function storageError(error: { message?: string }) {
  const message = error.message ?? "";
  if (message.includes("SARJY_CONFLICT"))
    return new NutritionError(
      "Your food records changed. Read current state before retrying.",
      409,
    );
  if (message.includes("SARJY_RATE_LIMIT"))
    return new NutritionError("Please wait a minute before trying again", 429);
  if (message.includes("SARJY_LEGACY_ALREADY_IMPORTED"))
    return new NutritionError(
      "These browser records were already imported into another session. Your local copy is intact.",
      409,
    );
  if (message.includes("SARJY_AUTH_REQUIRED"))
    return new NutritionError(
      "Your session could not be verified. Reload before trying again.",
      401,
    );
  return new NutritionError(
    "Supabase could not load or save your records. Your saved data is safe; please try again.",
    503,
  );
}
export async function currentUser(): Promise<Owner> {
  if (!supabaseConfigured()) return { id: await local.guestId() };
  const jar = await cookies();
  const legacy = jar.get("sarjy_guest")?.value;
  const client = await serverSupabase();
  const existingSession = jar
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && c.value);
  const { data, error } = await client.auth.getClaims();
  if (data?.claims.sub && uuid.test(data.claims.sub))
    return {
      id: data.claims.sub,
      client,
      ...(legacy && uuid.test(legacy) ? { legacyId: legacy } : {}),
    };
  if (existingSession || (error && error.name !== "AuthSessionMissingError"))
    throw new NutritionError(
      "Your Supabase session could not be restored. Reload to retry; your records have not been replaced.",
      401,
    );
  const legacyId = legacy && uuid.test(legacy) ? legacy : undefined;
  const session = await anonymousSession(client, legacyId);
  return { id: session.user.id, client, ...(legacyId ? { legacyId } : {}) };
}
export async function readWorkspace(owner: Owner): Promise<Workspace> {
  if (!owner.client) return local.readWorkspace(owner.id);
  const { data, error } = await owner.client
    .from("sarjy_workspaces")
    .select("data")
    .eq("user_id", owner.id)
    .maybeSingle();
  if (error) throw storageError(error);
  if (data) {
    if (owner.legacyId) (await cookies()).delete("sarjy_guest");
    return data.data as Workspace;
  }
  const legacy = owner.legacyId ? await local.readLegacyWorkspace(owner.legacyId) : null;
  const created = await owner.client.rpc("initialize_sarjy_workspace", {
    p_initial: legacy ?? emptyWorkspace(),
    p_legacy_id: legacy ? owner.legacyId : null,
  });
  if (created.error) throw storageError(created.error);
  if (owner.legacyId) (await cookies()).delete("sarjy_guest");
  return created.data as Workspace;
}
export async function mutateWorkspace(
  owner: Owner,
  version: number,
  action: Action,
  callId: string,
  prepared?: Workspace,
) {
  if (!owner.client) return local.mutateWorkspace(owner.id, version, action, callId);
  const current = prepared ?? (await readWorkspace(owner));
  if (current.appliedCalls.includes(callId)) return current;
  if (current.version !== version)
    throw new NutritionError("Your food records changed. Read current state before retrying.", 409);
  const next = applyAction(current, action);
  next.appliedCalls = [...next.appliedCalls.slice(-199), callId];
  if (JSON.stringify(next).length > 8000000)
    throw new NutritionError("Your food history is full. Export your records before adding more.");
  const result = await owner.client.rpc("commit_sarjy_workspace", {
    p_expected_version: version,
    p_next: next,
    p_call_id: callId,
  });
  if (result.error) throw storageError(result.error);
  return result.data as Workspace;
}
export async function limitRequests(
  owner: Owner,
  limit = 120,
  scope: "actions" | "voice" = "actions",
) {
  if (!owner.client)
    return local.limitRequests(scope === "voice" ? `voice:${owner.id}` : owner.id, limit);
  const result = await owner.client.rpc("consume_sarjy_rate_limit", { p_scope: scope });
  if (result.error) throw storageError(result.error);
}
