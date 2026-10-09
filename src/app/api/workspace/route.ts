import { errorResponse, json } from "@/lib/trips/http";
import { guestId, readWorkspace } from "@/lib/trips/store";
export const runtime = "nodejs";
export async function GET() {
  try { return json({ workspace: await readWorkspace(await guestId()) }); }
  catch (error) { return errorResponse(error); }
}
