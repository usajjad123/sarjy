import { GoogleGenAI, type Session, type LiveServerMessage } from "@google/genai";
import { TRANSCRIPTION_MODEL } from "./transcription-config";

export class LiveInputTranscriber {
  private session: Session | null = null;
  private generation = 0;
  private finalized = "";

  constructor(
    private onCaption: (text: string, interim: boolean) => void,
    private onUnavailable: () => void,
  ) {}

  async connect() {
    this.disconnect();
    const generation = ++this.generation;
    const response = await fetch("/api/transcription-token", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (generation !== this.generation) return;
    if (!response.ok || !body.token) throw new Error("Live captions unavailable");
    const ai = new GoogleGenAI({ apiKey: body.token, httpOptions: { apiVersion: "v1alpha" } });
    const session = await ai.live.connect({
      model: TRANSCRIPTION_MODEL,
      config: body.config,
      callbacks: {
        onmessage: (message) => {
          if (generation === this.generation) this.handleMessage(message);
        },
        onerror: () => {
          if (generation === this.generation) {
            this.disconnect();
            this.onUnavailable();
          }
        },
        onclose: () => {
          if (generation === this.generation) {
            this.disconnect();
            this.onUnavailable();
          }
        },
      },
    });
    if (generation !== this.generation) session.close();
    else this.session = session;
    return this.session !== null;
  }

  private handleMessage(message: LiveServerMessage) {
    const content = message.serverContent;
    if (content?.inputTranscription?.text) {
      this.finalized += content.inputTranscription.text;
      this.onCaption(this.finalized, false);
    } else if (content?.interimInputTranscription?.text) {
      // Interim hypotheses replace the previous hypothesis; they are not deltas.
      this.onCaption(this.finalized + content.interimInputTranscription.text, true);
    }
  }

  resetUtterance() {
    this.finalized = "";
  }

  sendAudio(data: string, sampleRate: number) {
    try {
      this.session?.sendRealtimeInput({
        audio: { data, mimeType: `audio/pcm;rate=${sampleRate}` },
      });
    } catch {
      this.disconnect();
      this.onUnavailable();
    }
  }

  disconnect() {
    this.generation++;
    const session = this.session;
    this.session = null;
    session?.close();
    this.finalized = "";
  }
}
