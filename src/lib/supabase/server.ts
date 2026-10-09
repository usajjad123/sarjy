import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NutritionError } from "@/features/nutrition/engine";
export function supabaseConfigured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); }
export async function serverSupabase() {
  if (!supabaseConfigured()) throw new NutritionError("Supabase connection is not configured", 503);
  const jar = await cookies();
  // Auth is used only in Route Handlers, where cookie refresh writes are allowed.
  // The browser calls our API; it does not read session tokens or privileged keys.
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: { getAll: () => jar.getAll(), setAll: (items) => { for (const { name, value, options } of items) jar.set(name, value, options); } },
  });
}
