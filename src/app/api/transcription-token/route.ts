import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { currentUser, limitRequests } from "@/features/food-logging/store";
import { checkOrigin, errorResponse } from "@/features/food-logging/http";
import {
  TRANSCRIPTION_MODEL,
  transcriptionConfig,
} from "@/lib/realtime/gemini/transcription-config";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json({ error: "Live captions are not configured" }, { status: 503 });
  try {
    checkOrigin(request);
    const user = await currentUser();
    await limitRequests(user, 12, "voice");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        liveConnectConstraints: { model: TRANSCRIPTION_MODEL, config: transcriptionConfig },
      },
    });
    if (!token.name) throw new Error("No token returned");
    return NextResponse.json(
      { token: token.name, config: transcriptionConfig },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && "status" in error) return errorResponse(error);
    return NextResponse.json(
      { error: "Live captions are temporarily unavailable" },
      { status: 502 },
    );
  }
}
