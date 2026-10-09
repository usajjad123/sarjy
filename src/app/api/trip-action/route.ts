import { activeTrip, TripError } from "@/lib/trips/model";
import { checkOrigin, errorResponse, json } from "@/lib/trips/http";
import { guestId, limitRequests, mutateWorkspace, readWorkspace } from "@/lib/trips/store";
import { getWeather, tripExperience } from "@/lib/trips/weather";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length")) > 60000) throw new TripError("Action is too large", 413);
    const body = await request.json();
    if (JSON.stringify(body).length > 60000 || typeof body.name !== "string" || !body.args || typeof body.args !== "object") throw new TripError("Invalid action");
    const id = await guestId(); await limitRequests(id);
    if (body.callId !== undefined && (typeof body.callId !== "string" || body.callId.length > 200)) throw new TripError("Invalid call ID");
    const current = await readWorkspace(id);
    const editingTrip = ["set_day_plan", "add_activity", "update_activity", "move_activity", "remove_activity", "update_trip"].includes(body.name);
    if (editingTrip && body.targetTripId !== undefined && body.targetTripId !== current.activeTripId) throw new TripError("The selected trip changed. Read the current trip before editing.", 409);
    const reading = body.name === "get_trip_context";
    if (!reading && !Number.isInteger(body.expectedVersion)) throw new TripError("Include the current itinerary version");
    const workspace = reading ? await readWorkspace(id) : await mutateWorkspace(id, body.expectedVersion, { name: body.name, args: body.args }, body.callId);
    const trip = activeTrip(workspace);
    const weather = trip && body.includeWeather !== false ? await getWeather(trip) : null;
    return json({ workspace, weather, experience: trip && weather ? tripExperience(trip, weather) : null, status: reading ? "current" : "saved", persisted: true });
  } catch (error) { return errorResponse(error); }
}
