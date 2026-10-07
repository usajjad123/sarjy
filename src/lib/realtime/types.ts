export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export type VoiceEvent =
  | {
      type: "state";
      state: VoiceState;
    }
  | {
      type: "user_transcript";
      text: string;
    }
  | {
      type: "assistant_transcript";
      text: string;
    }
  | {
      type: "error";
      error: Error;
    };