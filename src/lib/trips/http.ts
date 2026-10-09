import { NextResponse } from "next/server";
import { TripError } from "./model";
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host === request.headers.get("host")) return; } catch { /* Invalid Origin */ }
    throw new TripError("Origin not allowed", 403);
  }
}
export const json = (value: unknown) => NextResponse.json(value, { headers: { "Cache-Control": "private, no-store" } });
export function errorResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof TripError ? error.message : "Something went wrong. Your saved itinerary is safe; please try again." }, { status: error instanceof TripError ? error.status : 500 });
}
