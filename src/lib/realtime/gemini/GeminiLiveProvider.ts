import { GoogleGenAI, Modality } from "@google/genai";

import type { RealtimeProvider } from "../provider";
import type { VoiceEvent } from "../types";

export class GeminiLiveProvider implements RealtimeProvider {
  private ai: GoogleGenAI;
  private session: any = null;

  private listeners = new Set<(event: VoiceEvent) => void>();

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({
      apiKey,
    });
  }

  private emit(event: VoiceEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  onEvent(callback: (event: VoiceEvent) => void) {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  async connect() {
    this.emit({
      type: "state",
      state: "connecting",
    });

    this.session = await this.ai.live.connect({
      model: "gemini-3.8-live",

      config: {
        responseModalities: [Modality.AUDIO],

        systemInstruction:
          "You are a friendly conversational voice assistant. Keep your responses natural and concise.",

        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },

      callbacks: {
        onopen: () => {
          console.log("Gemini Live connected");

          this.emit({
            type: "state",
            state: "listening",
          });
        },

        onmessage: (message) => {
          console.log("Gemini message:", message);
        },

        onerror: (error) => {
          console.error("Gemini error:", error);

          this.emit({
            type: "error",
            error: new Error("Gemini Live connection failed"),
          });
        },

        onclose: (event) => {
          console.log("Gemini closed:", event);

          this.session = null;

          this.emit({
            type: "state",
            state: "idle",
          });
        },
      },
    });
  }

  disconnect() {
    this.session?.close();
    this.session = null;
  }
}