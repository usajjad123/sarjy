import { errorResponse, json } from "@/features/food-logging/http";
import { guestId, mutateWorkspace, readWorkspace } from "@/features/food-logging/store";
import { NutritionError } from "@/features/nutrition/engine";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const id = await guestId(); let workspace = await readWorkspace(id);
    const timezone = new URL(request.url).searchParams.get("timezone");
    if (workspace.version === 0 && timezone) {
      try { workspace = await mutateWorkspace(id, 0, { name: "set_timezone", args: { timezone } }, "initial-browser-timezone"); }
      catch (error) { if (error instanceof NutritionError && error.status === 409) workspace = await readWorkspace(id); else throw error; }
    }
    return json({ workspace, storage: process.env.DATABASE_URL ? "postgresql" : "local", foodLookup: process.env.USDA_API_KEY ? "configured" : process.env.NODE_ENV !== "production" ? "demo" : "missing" });
  } catch (error) { return errorResponse(error); }
}
