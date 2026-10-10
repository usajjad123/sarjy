import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { compile, moduleURL } from "./helpers/typescript.mjs";

const require = createRequire(import.meta.url);
const engine = compile("../src/features/nutrition/engine.ts");
const model = compile("../src/features/food-logging/model.ts", { "../nutrition/engine": engine });
const storage = await import(
  compile("../src/features/food-logging/local-store.ts", {
    "server-only": moduleURL(""),
    "next/headers": moduleURL("export const cookies = () => {};"),
    "@libsql/client": pathToFileURL(require.resolve("@libsql/client")).href,
    "./model": model,
    "../nutrition/engine": engine,
  })
);

test("local SQLite preserves records, rejects competing edits and safely replays retries", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sarjy-storage-"));
  t.mock.method(process, "cwd", () => directory);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const user = crypto.randomUUID();
  const initial = await storage.readWorkspace(user);
  assert.equal(initial.version, 0);
  const action = { name: "remember_fact", args: { key: "favorite_color", value: "blue" } };
  const saved = await storage.mutateWorkspace(user, 0, action, "remember-color");
  assert.deepEqual(await storage.readWorkspace(user), saved);
  assert.deepEqual(await storage.mutateWorkspace(user, 0, action, "remember-color"), saved);
  const edits = await Promise.allSettled([
    storage.mutateWorkspace(
      user,
      saved.version,
      {
        name: "set_goals",
        args: { protein: 130 },
      },
      "first-edit",
    ),
    storage.mutateWorkspace(
      user,
      saved.version,
      {
        name: "set_goals",
        args: { protein: 140 },
      },
      "second-edit",
    ),
  ]);
  assert.equal(edits.filter((edit) => edit.status === "fulfilled").length, 1);
  assert.equal(edits.find((edit) => edit.status === "rejected").reason.status, 409);
  const current = await storage.readWorkspace(user);
  assert.equal(current.version, saved.version + 1);
  assert.deepEqual(await storage.readLegacyWorkspace(user), current);
  assert.equal(await storage.readLegacyWorkspace(crypto.randomUUID()), null);
  await storage.limitRequests(user, 1);
  await assert.rejects(storage.limitRequests(user, 1), (error) => error.status === 429);
});
