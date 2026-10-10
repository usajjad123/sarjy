import "server-only";
import postgres from "postgres";
import { createClient } from "@libsql/client";
import { mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { cookies } from "next/headers";
import { applyAction, emptyWorkspace, type Action, type Workspace } from "./model";
import { NutritionError } from "../nutrition/engine";
type DB = {
  query: (
    sql: string,
    args?: (string | number)[],
  ) => Promise<{ rows: Record<string, unknown>[]; count: number }>;
};
let database: Promise<DB> | undefined;
function db() {
  return (database ??= (async () => {
    let adapter: DB;
    if (process.env.DATABASE_URL) {
      const sql = postgres(process.env.DATABASE_URL, {
        max: 3,
        prepare: false,
        connect_timeout: 10,
      });
      adapter = {
        query: async (query, args = []) => {
          let i = 0;
          const result = await sql.unsafe(
            query.replaceAll("?", () => `$${++i}`),
            args,
          );
          return { rows: Array.from(result), count: result.count };
        },
      };
    } else {
      if (process.env.NODE_ENV === "production" || process.env.VERCEL)
        throw new NutritionError("Configure DATABASE_URL for durable PostgreSQL storage", 503);
      await mkdir(join(process.cwd(), ".data"), { recursive: true });
      const sql = createClient({ url: `file:${join(process.cwd(), ".data", "sarjy-fit.db")}` });
      adapter = {
        query: async (query, args = []) => {
          const r = await sql.execute({ sql: query, args });
          return { rows: r.rows as Record<string, unknown>[], count: r.rowsAffected };
        },
      };
    }
    await adapter.query(
      "CREATE TABLE IF NOT EXISTS fit_workspaces (id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)",
    );
    await adapter.query(
      "CREATE TABLE IF NOT EXISTS fit_rate_limits (id TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL)",
    );
    return adapter;
  })().catch((error) => {
    database = undefined;
    throw error;
  }));
}
export async function guestId() {
  const jar = await cookies(),
    existing = jar.get("sarjy_guest")?.value;
  if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing))
    return existing;
  const id = crypto.randomUUID();
  jar.set("sarjy_guest", id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 31536000,
  });
  return id;
}
export async function readWorkspace(id: string): Promise<Workspace> {
  const sql = await db();
  await sql.query(
    "INSERT INTO fit_workspaces (id,version,data) VALUES (?,0,?) ON CONFLICT(id) DO NOTHING",
    [id, JSON.stringify(emptyWorkspace())],
  );
  const r = await sql.query("SELECT data FROM fit_workspaces WHERE id=?", [id]);
  return JSON.parse(String(r.rows[0].data));
}
export async function mutateWorkspace(id: string, version: number, action: Action, callId: string) {
  const current = await readWorkspace(id);
  if (current.appliedCalls.includes(callId)) return current;
  if (current.version !== version)
    throw new NutritionError("Your food records changed. Read current state before retrying.", 409);
  const next = applyAction(current, action);
  next.appliedCalls = [...next.appliedCalls.slice(-199), callId];
  const encoded = JSON.stringify(next);
  if (encoded.length > 8000000)
    throw new NutritionError("Your food history is full. Export your records before adding more.");
  const result = await (
    await db()
  ).query("UPDATE fit_workspaces SET version=?,data=? WHERE id=? AND version=?", [
    next.version,
    encoded,
    id,
    version,
  ]);
  if (!result.count) {
    const fresh = await readWorkspace(id);
    if (fresh.appliedCalls.includes(callId)) return fresh;
    throw new NutritionError(
      "Another edit changed your records. Read current state and reconsider the edit.",
      409,
    );
  }
  return next;
}
export async function limitRequests(id: string, limit = 120) {
  const window = Math.floor(Date.now() / 60000);
  const r = await (
    await db()
  ).query(
    "INSERT INTO fit_rate_limits (id,bucket,count) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN fit_rate_limits.bucket=excluded.bucket THEN fit_rate_limits.count+1 ELSE 1 END,bucket=excluded.bucket RETURNING count",
    [id, window],
  );
  if (Number(r.rows[0].count) > limit)
    throw new NutritionError("Please wait a minute before trying again", 429);
}

// Read-only, one-time import of the existing browser's development records.
// A hosted deployment never reads from an ephemeral local filesystem.
export async function readLegacyWorkspace(id: string): Promise<Workspace | null> {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL || process.env.DATABASE_URL)
    return null;
  const path = join(process.cwd(), ".data", "sarjy-fit.db");
  try {
    await access(path);
  } catch {
    return null;
  }
  const client = createClient({ url: `file:${path}` });
  try {
    const result = await client.execute({
      sql: "SELECT data FROM fit_workspaces WHERE id=?",
      args: [id],
    });
    return result.rows.length ? (JSON.parse(String(result.rows[0].data)) as Workspace) : null;
  } finally {
    client.close();
  }
}
