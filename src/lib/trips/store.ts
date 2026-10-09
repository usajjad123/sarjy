import "server-only";
import { createClient, type Client } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { cookies } from "next/headers";
import { applyTripAction, emptyWorkspace, TripError, type Workspace, type TripAction } from "./model";

let database: Promise<Client> | undefined;
function db() {
  return database ??= (async () => {
    let url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      if (process.env.VERCEL) throw new TripError("Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for durable hosted storage", 503);
      await mkdir(join(process.cwd(), ".data"), { recursive: true });
      url = `file:${join(process.cwd(), ".data", "sarjy.db")}`;
    }
    const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    await client.execute("CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)");
    await client.execute("CREATE TABLE IF NOT EXISTS request_limits (id TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL)");
    return client;
  })();
}
export async function guestId() {
  const jar = await cookies();
  const existing = jar.get("sarjy_guest")?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  jar.set("sarjy_guest", id, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return id;
}
export async function readWorkspace(id: string): Promise<Workspace> {
  const client = await db();
  const initial = emptyWorkspace();
  await client.execute({ sql: "INSERT OR IGNORE INTO workspaces (id,version,data) VALUES (?,0,?)", args: [id, JSON.stringify(initial)] });
  const result = await client.execute({ sql: "SELECT data FROM workspaces WHERE id=?", args: [id] });
  return JSON.parse(String(result.rows[0].data)) as Workspace;
}
export async function mutateWorkspace(id: string, expectedVersion: number, action: TripAction, callId?: string): Promise<Workspace> {
  const current = await readWorkspace(id);
  if (callId && current.appliedCalls.includes(callId)) return current;
  if (current.version !== expectedVersion) throw new TripError("The itinerary changed. Refresh the current trip and try the edit again.", 409);
  const next = applyTripAction(current, action);
  if (callId) next.appliedCalls = [...next.appliedCalls.slice(-99), callId];
  const result = await (await db()).execute({ sql: "UPDATE workspaces SET version=?,data=? WHERE id=? AND version=?", args: [next.version, JSON.stringify(next), id, current.version] });
  if (!result.rowsAffected) throw new TripError("Another edit just changed the itinerary. Read the current trip and retry.", 409);
  return next;
}
export async function limitRequests(id: string, limit = 180) {
  const window = Math.floor(Date.now() / 60000);
  const result = await (await db()).execute({ sql: "INSERT INTO request_limits (id,window,count) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count", args: [id, window] });
  if (Number(result.rows[0].count) > limit) throw new TripError("Please wait a minute before trying again", 429);
}
