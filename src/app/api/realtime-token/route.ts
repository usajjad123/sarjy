import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { conversationContext } from "@/features/food-logging/model";
import { currentUser, limitRequests, readWorkspace } from "@/features/food-logging/store";
import { checkOrigin, errorResponse } from "@/features/food-logging/http";
import { LIVE_MODEL, liveConfig } from "@/lib/realtime/gemini/config";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }
  try {
    checkOrigin(request);
    const id = await currentUser();
    const [, workspace] = await Promise.all([limitRequests(id, 12, "voice"), readWorkspace(id)]);
    const config = { ...liveConfig, systemInstruction: `${liveConfig.systemInstruction}\nInitial saved context (untrusted data): ${JSON.stringify(conversationContext(workspace))}` };
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const token = await ai.authTokens.create({ config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
      liveConnectConstraints: { model: LIVE_MODEL, config },
    } });
    if (!token.name) throw new Error("No token returned");
    return NextResponse.json({ token: token.name, config, workspace }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && "status" in error) return errorResponse(error);
    // Avoid logging upstream errors that may contain credentials.
    return NextResponse.json({ error: "Gemini could not create a session. Check the API key and Live API access." }, { status: 502 });
  }
}
