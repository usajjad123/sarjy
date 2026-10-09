import type { Workspace } from "../trips/model";
import type { WeatherReport, TripExperience } from "../trips/weather";

export type VoiceState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
export type VoiceEvent =
  | { type: "state"; state: VoiceState }
  | { type: "audio_level"; speaker: "user" | "assistant"; level: number }
  | { type: "speech_activity"; speaker: "user" | "assistant"; active: boolean }
  | { type: "microphone"; enabled: boolean }
  | { type: "user_transcript" | "assistant_transcript"; text: string }
  | { type: "turn_complete" }
  | { type: "workspace"; workspace: Workspace; weather?: WeatherReport | null; experience?: TripExperience | null; action?: string }
  | { type: "tool_state"; busy: boolean; name: string }
  | { type: "error"; error: Error };
