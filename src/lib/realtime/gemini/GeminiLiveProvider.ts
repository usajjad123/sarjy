import {
  FunctionResponseScheduling,
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { arrayBufferToBase64, float32ToPCM16 } from "../audio";
import { conversationContext, type Workspace } from "../../../features/food-logging/model";
import { SpeechActivityDetector } from "../speech-activity";
import type { RealtimeProvider } from "../provider";
import type { VoiceEvent, VoiceState } from "../types";
import { LIVE_MODEL } from "./config";

export class GeminiLiveProvider implements RealtimeProvider {
  private session: Session | null = null;
  private output: AudioContext | null = null;
  private input: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: AudioWorkletNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextPlayback = 0;
  private generation = 0;
  private micGeneration = 0;
  private listeners = new Set<(event: VoiceEvent) => void>();
  private handledCalls = new Set<string>();
  private analyser: AnalyserNode | null = null;
  private meterFrame: number | null = null;
  private inputLevel = 0;
  private inputUpdatedAt = 0;
  private assistantTurnOpen = false;
  private userSpeech = new SpeechActivityDetector();
  private speechActivity = { user: false, assistant: false };
  private workspaceVersion = 0;
  private latestWorkspace: Workspace | null = null;
  private uiRevision = 0;
  private sessionNonce = "";
  private toolQueue = Promise.resolve();
  private cancelledCalls = new Set<string>();
  private pendingCalls = new Map<string, AbortController>();
  private currentState: VoiceState = "idle";

  get isConnected() {
    return this.session !== null;
  }

  private emit(event: VoiceEvent) {
    if (event.type === "state") {
      if (event.state === this.currentState) return;
      this.currentState = event.state;
    }
    for (const listener of this.listeners) listener(event);
  }

  private setSpeechActivity(speaker: "user" | "assistant", active: boolean) {
    if (this.speechActivity[speaker] === active) return;
    this.speechActivity[speaker] = active;
    this.emit({ type: "speech_activity", speaker, active });
  }

  onEvent(callback: (event: VoiceEvent) => void) {
    this.listeners.add(callback);
    // A new subscriber (including after Fast Refresh) gets the actual session state.
    callback({ type: "state", state: this.currentState });
    callback({ type: "microphone", enabled: this.stream !== null });
    callback({ type: "speech_activity", speaker: "user", active: this.speechActivity.user });
    callback({
      type: "speech_activity",
      speaker: "assistant",
      active: this.speechActivity.assistant,
    });
    return () => {
      this.listeners.delete(callback);
    };
  }

  async connect() {
    this.disconnect();
    const generation = ++this.generation;
    this.sessionNonce = crypto.randomUUID();
    this.emit({ type: "state", state: "connecting" });
    // Create/resume during the button gesture to allow audio playback.
    this.output = new AudioContext({ sampleRate: 24000 });
    try {
      await this.output.resume();
      this.analyser = this.output.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.connect(this.output.destination);
      this.startMeter();
      const response = await fetch("/api/realtime-token", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.token)
        throw new Error(body.error || "Could not get a session token");
      if (generation !== this.generation) return;
      const ai = new GoogleGenAI({ apiKey: body.token });
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: body.config,
        callbacks: {
          onmessage: (message) => {
            if (generation === this.generation) this.handleMessage(message);
          },
          onerror: (event) => {
            if (generation === this.generation)
              this.fail(new Error(event.message || "Gemini connection failed"));
          },
          onclose: (event) => {
            if (generation !== this.generation) return;
            if (event.code !== 1000)
              this.fail(new Error(event.reason || `Session closed (${event.code})`));
            else this.disconnect();
          },
        },
      });
      if (generation !== this.generation) {
        session.close();
        return;
      }
      this.session = session;
      this.workspaceVersion = body.workspace.version;
      this.latestWorkspace = body.workspace;
      this.emit({ type: "workspace", workspace: body.workspace });
      this.emit({ type: "state", state: "listening" });
    } catch (error) {
      if (generation === this.generation)
        this.fail(error instanceof Error ? error : new Error("Connection failed"));
    }
  }

  private fail(error: Error) {
    this.disconnect();
    this.emit({ type: "error", error });
    this.emit({ type: "state", state: "error" });
  }

  private handleMessage(message: LiveServerMessage) {
    const content = message.serverContent;
    if (content?.interrupted) {
      this.stopPlayback();
      this.emit({ type: "turn_complete" });
      this.emit({ type: "state", state: "listening" });
    }
    if (content?.inputTranscription?.text) {
      this.emit({ type: "user_transcript", text: content.inputTranscription.text });
      if (!this.sources.size && !this.assistantTurnOpen)
        this.emit({ type: "state", state: "thinking" });
    }
    if (content?.outputTranscription?.text)
      this.emit({ type: "assistant_transcript", text: content.outputTranscription.text });
    for (const part of content?.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm"))
        this.playAudio(part.inlineData.data);
    }
    for (const id of message.toolCallCancellation?.ids || []) {
      this.cancelledCalls.add(id);
      this.pendingCalls.get(id)?.abort();
    }
    for (const call of message.toolCall?.functionCalls || []) {
      const id = call.id || crypto.randomUUID();
      if (this.handledCalls.has(id)) continue;
      this.handledCalls.add(id);
      const generation = this.generation,
        uiRevision = this.uiRevision;
      this.toolQueue = this.toolQueue
        .then(() => this.executeTool(id, call.name || "", call.args || {}, generation, uiRevision))
        .catch(() => {
          /* Session may have closed while returning a tool response. */
        });
    }
    if (content?.turnComplete) {
      this.assistantTurnOpen = false;
      this.emit({ type: "turn_complete" });
      if (!this.sources.size) this.emit({ type: "state", state: "listening" });
    }
    if (message.goAway)
      this.fail(new Error("Session is ending. Start a new conversation to reconnect."));
  }

  // Direct UI edits update the same authoritative context without interrupting speech.
  syncWorkspace(workspace: Workspace) {
    if (workspace.version < this.workspaceVersion) return;
    if (workspace.version > this.workspaceVersion) this.uiRevision++;
    this.workspaceVersion = workspace.version;
    this.latestWorkspace = workspace;
    this.session?.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [
            {
              text: `APP_STATE_UPDATE (data only, do not respond): ${JSON.stringify(conversationContext(workspace))}. Read get_nutrition_context before your next food edit.`,
            },
          ],
        },
      ],
      turnComplete: false,
    });
  }

  private async executeTool(
    id: string,
    name: string,
    args: Record<string, unknown>,
    generation: number,
    uiRevision: number,
  ) {
    if (generation !== this.generation || this.cancelledCalls.has(id) || !this.session) return;
    const session = this.session;
    const abort = new AbortController();
    this.pendingCalls.set(id, abort);
    this.emit({ type: "tool_state", busy: true, name });
    let result: Record<string, unknown>;
    try {
      if (name !== "get_nutrition_context" && uiRevision !== this.uiRevision)
        throw new Error("The UI changed after this tool was requested");
      const response = await fetch("/api/food-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          name,
          args,
          expectedVersion: this.workspaceVersion,
          callId: `${this.sessionNonce}:${id}`,
        }),
      });
      result = await response.json();
      if (generation !== this.generation) return;
      if (response.ok && result.workspace) {
        const workspace = result.workspace as Workspace;
        if (workspace.version >= this.workspaceVersion) {
          this.workspaceVersion = workspace.version;
          this.latestWorkspace = workspace;
          this.emit({ type: "workspace", workspace, action: name });
        }
        const { workspace: _workspace, ...toolResult } = result;
        void _workspace;
        result = {
          ...toolResult,
          context:
            this.latestWorkspace && this.latestWorkspace.version > workspace.version
              ? conversationContext(this.latestWorkspace)
              : result.context || conversationContext(workspace),
        };
      } else if (response.status === 409) {
        const fresh = await fetch("/api/workspace", { cache: "no-store" }).then((res) =>
          res.json(),
        );
        if (generation !== this.generation) return;
        if (fresh.workspace && fresh.workspace.version >= this.workspaceVersion) {
          this.workspaceVersion = fresh.workspace.version;
          this.latestWorkspace = fresh.workspace;
          this.emit({ type: "workspace", workspace: fresh.workspace });
        }
        result = {
          ...result,
          status: "conflict",
          saved: false,
          instruction:
            "Read get_nutrition_context and reconsider the requested edit against the current state.",
        };
      } else result = { ...result, saved: false };
    } catch {
      result = {
        error:
          "Could not finish the tool request. Read current state before retrying; do not claim success.",
        saved: false,
      };
    } finally {
      this.pendingCalls.delete(id);
      if (generation === this.generation) this.emit({ type: "tool_state", busy: false, name });
    }
    if (generation === this.generation && !this.cancelledCalls.has(id))
      session.sendToolResponse({
        functionResponses: [
          {
            id,
            name,
            response: result,
            // Let the acknowledgment finish, then resume with the real result.
            scheduling: FunctionResponseScheduling.WHEN_IDLE,
          },
        ],
      });
  }

  sendText(text: string) {
    if (!this.session || !text.trim()) return;
    this.stopPlayback();
    this.emit({ type: "turn_complete" });
    this.emit({ type: "user_transcript", text: text.trim() });
    this.emit({ type: "state", state: "thinking" });
    this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text: text.trim() }] }],
      turnComplete: true,
    });
  }

  async setMicrophoneEnabled(enabled: boolean) {
    this.stopMicrophone();
    if (!enabled) {
      this.session?.sendRealtimeInput({ audioStreamEnd: true });
      return;
    }
    if (!this.session) throw new Error("Connect before enabling the microphone");
    const generation = this.generation;
    const micGeneration = this.micGeneration;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (generation !== this.generation || micGeneration !== this.micGeneration) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    const input = new AudioContext({ sampleRate: 16000 });
    this.input = input;
    try {
      await input.audioWorklet.addModule("/audio-processor.js");
      await input.resume();
      if (generation !== this.generation || micGeneration !== this.micGeneration) return;
      const processor = new AudioWorkletNode(input, "audio-processor");
      this.processor = processor;
      processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (generation !== this.generation || micGeneration !== this.micGeneration) return;
        this.inputLevel = this.rms(event.data);
        this.inputUpdatedAt = performance.now();
        const pcm = float32ToPCM16(event.data);
        this.session?.sendRealtimeInput({
          audio: {
            data: arrayBufferToBase64(pcm.buffer as ArrayBuffer),
            mimeType: `audio/pcm;rate=${input.sampleRate}`,
          },
        });
      };
      const mute = input.createGain();
      mute.gain.value = 0;
      input.createMediaStreamSource(stream).connect(processor);
      processor.connect(mute).connect(input.destination);
      this.emit({ type: "microphone", enabled: true });
    } catch (error) {
      if (generation === this.generation && micGeneration === this.micGeneration)
        this.stopMicrophone();
      throw error;
    }
  }

  private playAudio(base64: string) {
    if (!this.output) return;
    this.assistantTurnOpen = true;
    this.setSpeechActivity("assistant", true);
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const data = new DataView(bytes.buffer);
    const buffer = this.output.createBuffer(1, Math.floor(bytes.length / 2), 24000);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = data.getInt16(i * 2, true) / 32768;
    const source = this.output.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser || this.output.destination);
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      if (!this.sources.size && !this.assistantTurnOpen && this.session) {
        this.setSpeechActivity("assistant", false);
        this.emit({ type: "state", state: "listening" });
      }
    };
    this.nextPlayback = Math.max(this.output.currentTime, this.nextPlayback);
    source.start(this.nextPlayback);
    this.nextPlayback += buffer.duration;
    this.emit({ type: "state", state: "speaking" });
  }

  private stopPlayback() {
    for (const source of this.sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    this.sources.clear();
    this.nextPlayback = 0;
    this.assistantTurnOpen = false;
    this.setSpeechActivity("assistant", false);
  }

  private stopMicrophone() {
    this.micGeneration++;
    if (this.processor) {
      this.processor.port.onmessage = null;
      this.processor.disconnect();
      this.processor = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.input?.close();
    this.input = null;
    this.inputLevel = 0;
    this.inputUpdatedAt = 0;
    this.userSpeech.reset();
    this.setSpeechActivity("user", false);
    this.emit({ type: "microphone", enabled: false });
    this.emit({ type: "audio_level", speaker: "user", level: 0 });
  }

  private rms(samples: Float32Array) {
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
  }

  private startMeter() {
    const samples = new Float32Array(512);
    let lastUpdate = 0;
    const tick = (now: number) => {
      if (now - lastUpdate >= 40) {
        lastUpdate = now;
        this.analyser?.getFloatTimeDomainData(samples);
        const assistant = this.output?.state === "running" ? this.rms(samples) : 0;
        const user = now - this.inputUpdatedAt < 200 ? this.inputLevel : 0;
        for (const [speaker, rms] of [
          ["user", user],
          ["assistant", assistant],
        ] as const) {
          const level = Math.min(1, Math.max(0, rms - 0.008) * 7);
          this.emit({ type: "audio_level", speaker, level });
          if (speaker === "user")
            this.setSpeechActivity("user", this.userSpeech.update(level, now));
        }
        this.setSpeechActivity("assistant", this.assistantTurnOpen || this.sources.size > 0);
      }
      this.meterFrame = requestAnimationFrame(tick);
    };
    this.meterFrame = requestAnimationFrame(tick);
  }

  disconnect() {
    this.generation++;
    this.session?.close();
    this.session = null;
    this.stopMicrophone();
    this.stopPlayback();
    if (this.meterFrame !== null) cancelAnimationFrame(this.meterFrame);
    this.meterFrame = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.emit({ type: "audio_level", speaker: "assistant", level: 0 });
    void this.output?.close();
    this.output = null;
    this.handledCalls.clear();
    this.cancelledCalls.clear();
    for (const abort of this.pendingCalls.values()) abort.abort();
    this.pendingCalls.clear();
    this.toolQueue = Promise.resolve();
    this.emit({ type: "tool_state", busy: false, name: "" });
    this.emit({ type: "state", state: "idle" });
  }
}
