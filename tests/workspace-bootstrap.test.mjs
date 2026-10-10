import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/load-workspace.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { loadWorkspace } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

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
