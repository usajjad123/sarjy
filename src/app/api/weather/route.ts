import { activeTrip, TripError } from "@/lib/trips/model";
import { errorResponse, json } from "@/lib/trips/http";
import { guestId, limitRequests, readWorkspace } from "@/lib/trips/store";
import { getWeather, tripExperience } from "@/lib/trips/weather";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const id = await guestId(); await limitRequests(id);
    const workspace = await readWorkspace(id);
    const trip = activeTrip(workspace);
    if (!trip) throw new TripError("Select a trip first");
    const weather = await getWeather(trip, new URL(request.url).searchParams.get("refresh") === "1");
    return json({ tripId: trip.id, version: workspace.version, weather, experience: tripExperience(trip, weather) });
  } catch (error) { return errorResponse(error); }
}
