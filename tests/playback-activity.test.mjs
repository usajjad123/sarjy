import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const dataModule = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return dataModule(outputText);
}
const providerModule = compile("../src/lib/realtime/gemini/GeminiLiveProvider.ts", {
  "@google/genai": dataModule("export class GoogleGenAI {}"),
  "../../../features/food-logging/model": dataModule("export const conversationContext = (w) => w;"),
  "../audio": compile("../src/lib/realtime/audio.ts"),
  "../speech-activity": compile("../src/lib/realtime/speech-activity.ts"),
  "./config": dataModule('export const LIVE_MODEL = "test"; export const liveConfig = {};'),
});
const { GeminiLiveProvider } = await import(providerModule);
function setup() {
  const provider = new GeminiLiveProvider();
  const events = [];
  const chunks = [];
  provider.onEvent((event) => events.push(event));
  events.length = 0;
  // Controlled Web Audio sources let us exercise network gaps and queued playback.
  provider.session = {};
  provider.output = {
    currentTime: 0, destination: {},
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size), duration: size / 24000 }),
    createBufferSource: () => {
      const source = { connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true; }, onended: null };
      chunks.push(source);
      return source;
    },
  };
  const audio = () => provider.handleMessage({ serverContent: { modelTurn: { parts: [{ inlineData: { data: "AAAAAA==", mimeType: "audio/pcm;rate=24000" } }] } } });
  return { provider, events, chunks, audio };
}
const speechEvents = (events) => events.filter((event) => event.type === "speech_activity" && event.speaker === "assistant");

test("silent audio and gaps between packets do not reset the assistant animation", () => {
  const { provider, events, chunks, audio } = setup();
  audio();
  chunks[0].onended();
  assert.deepEqual(speechEvents(events).map((event) => event.active), [true]);
  provider.handleMessage({ serverContent: { inputTranscription: { text: "background transcription" } } });
  assert.equal(events.some((event) => event.type === "state" && event.state === "thinking"), false);
  audio();
  provider.handleMessage({ serverContent: { turnComplete: true } });
  assert.deepEqual(speechEvents(events).map((event) => event.active), [true]);
  chunks[1].onended();
  assert.deepEqual(speechEvents(events).map((event) => event.active), [true, false]);
  assert.deepEqual(events.filter((event) => event.type === "state").map((event) => event.state), ["speaking", "listening"]);
});
test("an explicit interruption stops playback and releases the avatar immediately", () => {
  const { provider, events, chunks, audio } = setup();
  audio();
  provider.handleMessage({ serverContent: { interrupted: true } });
  assert.equal(chunks[0].stopped, true);
  assert.equal(chunks[0].onended, null);
  assert.deepEqual(speechEvents(events).map((event) => event.active), [true, false]);
  audio();
  assert.deepEqual(speechEvents(events).map((event) => event.active), [true, false, true]);
});
