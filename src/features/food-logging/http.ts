import { NextResponse } from "next/server";
import { NutritionError } from "../nutrition/engine";
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host === request.headers.get("host")) return;
    } catch {
      /* Invalid Origin */
    }
    throw new NutritionError("Origin not allowed", 403);
  }
}
export const json = (value: unknown) =>
  NextResponse.json(value, { headers: { "Cache-Control": "private, no-store" } });
export function errorResponse(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof NutritionError
          ? error.message
          : "Something went wrong. Your saved food records are safe; please try again.",
    },
    { status: error instanceof NutritionError ? error.status : 500 },
  );
}
