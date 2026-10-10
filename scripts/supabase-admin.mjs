import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { readFile } from "node:fs/promises";
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://missing");
if (!url.hostname.endsWith(".supabase.co")) throw new Error("Configure a Supabase project URL");
const ref = url.hostname.split(".")[0],
  token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is required for project setup");
async function api(path, method = "GET", body) {
  let response;
  try {
    response = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error("Supabase management request could not complete");
  }
  if (!response.ok) throw new Error(`Supabase management request failed (${response.status})`);
  return response.json();
}
try {
  const command = process.argv[2];
  if (command === "inspect") {
    const auth = await api("/config/auth");
    const schema = await api("/database/query", "POST", {
      read_only: true,
      query: "select tablename,rowsecurity from pg_tables where schemaname='public';",
    });
    console.log(
      JSON.stringify({ anonymousEnabled: auth.external_anonymous_users_enabled, tables: schema }),
    );
  } else if (command === "enable-anonymous") {
    const auth = await api("/config/auth", "PATCH", { external_anonymous_users_enabled: true });
    console.log(JSON.stringify({ anonymousEnabled: auth.external_anonymous_users_enabled }));
  } else if (command === "migrate") {
    const query = await readFile(
      new URL("../supabase/migrations/202610090001_sarjy_identity.sql", import.meta.url),
      "utf8",
    );
    await api("/database/query", "POST", { query });
    console.log("Sarjy workspace, import ownership, request limits and access policies applied");
  } else if (command === "verify") {
    const auth = await api("/config/auth");
    const rows = await api("/database/query", "POST", {
      read_only: true,
      query:
        "select jsonb_build_object('tables',(select jsonb_agg(jsonb_build_object('name',tablename,'rls',rowsecurity)) from pg_tables where schemaname='public' and tablename like 'sarjy_%')) as setup;",
    });
    console.log(
      JSON.stringify({ anonymousEnabled: auth.external_anonymous_users_enabled, schema: rows }),
    );
  } else throw new Error("Use inspect, enable-anonymous, migrate, or verify");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
