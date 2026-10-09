import type { VoiceEvent } from "./types";

export interface RealtimeProvider {
  connect(): Promise<void>;
  disconnect(): void;
  sendText(text: string): void;
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  onEvent(callback: (event: VoiceEvent) => void): () => void;
}
