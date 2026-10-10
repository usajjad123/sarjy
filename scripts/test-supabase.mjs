import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { compile } from "../tests/helpers/typescript.mjs";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, "Configure Supabase URL and publishable key");
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
const engine = compile("../src/features/nutrition/engine.ts");
const { emptyWorkspace, applyAction } = await import(
  compile("../src/features/food-logging/model.ts", { "../nutrition/engine": engine })
);
const a = client(),
  b = client(),
  publicClient = client();
const users = await Promise.all([a.auth.signInAnonymously(), b.auth.signInAnonymously()]);
for (const result of users) {
  assert.equal(result.error, null, "Anonymous signup should succeed");
  assert.equal(result.data.user.is_anonymous, true);
}
const aId = users[0].data.user.id,
  bId = users[1].data.user.id;
assert.notEqual(aId, bId);
const legacyId = crypto.randomUUID();
const initialized = await a.rpc("initialize_sarjy_workspace", {
  p_initial: emptyWorkspace(),
  p_legacy_id: legacyId,
});
assert.equal(initialized.error, null);
const stolenImport = await b.rpc("initialize_sarjy_workspace", {
  p_initial: emptyWorkspace(),
  p_legacy_id: legacyId,
});
assert.match(
  stolenImport.error?.message || "",
  /SARJY_LEGACY_ALREADY_IMPORTED/,
  "A legacy import must stay attached to its original owner",
);
const second = await b.rpc("initialize_sarjy_workspace", {
  p_initial: emptyWorkspace(),
  p_legacy_id: null,
});
assert.equal(second.error, null, "Workspace initialization failed");
let state = applyAction(emptyWorkspace(), {
  name: "remember_fact",
  args: { key: "test_preference", value: "Only user A can read this" },
});
const firstKey = crypto.randomUUID();
state.appliedCalls = [firstKey];
let saved = await a.rpc("commit_sarjy_workspace", {
  p_expected_version: 0,
  p_next: state,
  p_call_id: firstKey,
});
assert.equal(saved.error, null);
const hidden = await b.from("sarjy_workspaces").select("data").eq("user_id", aId);
assert.equal(hidden.error, null);
assert.deepEqual(hidden.data, [], "RLS must hide another user’s state");
const forbidden = await b
  .from("sarjy_workspaces")
  .update({ data: emptyWorkspace(), version: 0 })
  .eq("user_id", aId);
assert.ok(forbidden.error, "Direct table writes must be denied");
const publicRead = await publicClient.from("sarjy_workspaces").select("data");
assert.ok(publicRead.error, "Unauthenticated reads must be denied");
const publicWrite = await publicClient.rpc("commit_sarjy_workspace", {
  p_expected_version: 0,
  p_next: state,
  p_call_id: "public-write",
});
assert.ok(publicWrite.error, "Unauthenticated RPC writes must be denied");
const commands = [
  { name: "remember_fact", args: { key: "concurrent", value: "A" } },
  { name: "set_goals", args: { protein: 160 } },
];
const next = commands.map((command) => {
  const w = applyAction(state, command);
  const id = crypto.randomUUID();
  w.appliedCalls.push(id);
  return { p_expected_version: state.version, p_next: w, p_call_id: id };
});
const race = await Promise.all(next.map((params) => a.rpc("commit_sarjy_workspace", params)));
assert.equal(race.filter((r) => !r.error).length, 1);
assert.match(race.find((r) => r.error).error.message, /SARJY_CONFLICT/);
const winning = race.findIndex((r) => !r.error);
const replay = await a.rpc("commit_sarjy_workspace", next[winning]);
assert.equal(replay.error, null);
assert.equal(replay.data.version, 2, "Replay must not repeat operation");
const owned = await a.from("sarjy_workspaces").select("data");
assert.equal(owned.error, null);
assert.equal(owned.data.length, 1);
assert.equal(owned.data[0].data.memories[0].value, "Only user A can read this");
const reinitialized = await a.rpc("initialize_sarjy_workspace", {
  p_initial: emptyWorkspace(),
});
assert.equal(reinitialized.error, null);
assert.deepEqual(
  reinitialized.data,
  owned.data[0].data,
  "Initialization must preserve saved records",
);
let limitError;
let allowedRequests = 0;
// A run may cross a minute boundary, so allow one bucket reset.
for (let attempt = 0; attempt < 25; attempt++) {
  const result = await a.rpc("consume_sarjy_rate_limit", { p_scope: "voice" });
  if (result.error) {
    limitError = result.error;
    break;
  }
  allowedRequests++;
}
assert.ok(allowedRequests >= 12, "Allow the configured voice-session limit");
assert.match(limitError?.message || "", /SARJY_RATE_LIMIT/);
const otherUserLimit = await b.rpc("consume_sarjy_rate_limit", { p_scope: "voice" });
assert.equal(otherUserLimit.error, null, "Limits must be separate for each user");
const actionLimit = await a.rpc("consume_sarjy_rate_limit", { p_scope: "actions" });
assert.equal(actionLimit.error, null, "Voice limits must not block food actions");
const ref = new URL(url).hostname.split(".")[0];
const fake =
  "base64-" +
  Buffer.from(
    JSON.stringify({ access_token: "invalid", refresh_token: "invalid", user: { id: aId } }),
  ).toString("base64url");
const response = await fetch(
  (process.env.SARJY_TEST_URL || "http://127.0.0.1:3001") + "/api/workspace",
  { headers: { cookie: `sb-${ref}-auth-token=${fake}` } },
);
assert.equal(response.status, 401, "The app must verify a session rather than trust cookie claims");
console.log(
  JSON.stringify(
    {
      passed: true,
      checks: [
        "anonymous auth",
        "distinct user identities",
        "legacy import ownership",
        "persistent memory",
        "initialization preserves records",
        "RLS read isolation",
        "direct write denial",
        "unauthenticated denial",
        "concurrent conflict",
        "idempotent RPC replay",
        "per-user and per-scope request limits",
        "forged session rejection",
      ],
      testAccounts: "Two isolated anonymous test users; no existing user records were modified",
    },
    null,
    2,
  ),
);
