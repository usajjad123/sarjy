import type { VoiceEvent } from "./types";

export interface RealtimeProvider {
  connect(): Promise<void>;

  disconnect(): void;

  onEvent(callback: (event: VoiceEvent) => void): () => void;
}