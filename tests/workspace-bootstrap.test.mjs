import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "./helpers/typescript.mjs";

const { loadWorkspace } = await import(compile("../src/lib/load-workspace.ts"));

test("concurrent first loads share one request and anonymous identity", async (t) => {
  let finish;
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = loadWorkspace("Asia/Riyadh"),
    repeatedEffect = loadWorkspace("Asia/Riyadh");
  assert.equal(first, repeatedEffect);
  assert.equal(fetch.mock.callCount(), 1);
  const workspace = { version: 17, meals: [{ id: "existing-meal" }] };
  finish({ ok: true, json: async () => ({ workspace, storage: "supabase" }) });
  assert.deepEqual(await first, await repeatedEffect);
  assert.equal((await first).workspace, workspace);
  const reload = loadWorkspace("Asia/Riyadh");
  assert.notEqual(reload, first);
  assert.equal(fetch.mock.callCount(), 2);
  finish({ ok: true, json: async () => ({ workspace }) });
  await reload;
});

test("failed session bootstrap can be retried without replacing saved records", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    json: async () => ({ error: "Session could not be restored" }),
  }));
  await assert.rejects(loadWorkspace("Asia/Riyadh"), /Session could not be restored/);
  fetch.mock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ workspace: { version: 17 } }),
  }));
  assert.equal((await loadWorkspace("Asia/Riyadh")).workspace.version, 17);
  assert.equal(fetch.mock.callCount(), 2);
});
