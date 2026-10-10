import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const dataModule = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const [name, url] of Object.entries(imports))
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return dataModule(outputText);
}
const providerModule = compile("../src/lib/realtime/gemini/GeminiLiveProvider.ts", {
  "@google/genai": dataModule(
    'export class GoogleGenAI {} export const FunctionResponseScheduling = { WHEN_IDLE: "WHEN_IDLE" };',
  ),
  "../../../features/food-logging/model": dataModule(
    "export const conversationContext = (w) => w;",
  ),
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
    currentTime: 0,
    destination: {},
    createBuffer: (_, size) => ({
      getChannelData: () => new Float32Array(size),
      duration: size / 24000,
    }),
    createBufferSource: () => {
      const source = {
        connect() {},
        disconnect() {},
        start() {},
        stop() {
          this.stopped = true;
        },
        onended: null,
      };
      chunks.push(source);
      return source;
    },
  };
  const audio = () =>
    provider.handleMessage({
      serverContent: {
        modelTurn: {
          parts: [{ inlineData: { data: "AAAAAA==", mimeType: "audio/pcm;rate=24000" } }],
        },
      },
    });
  return { provider, events, chunks, audio };
}
const speechEvents = (events) =>
  events.filter((event) => event.type === "speech_activity" && event.speaker === "assistant");

test("silent audio and gaps between packets do not reset the assistant animation", () => {
  const { provider, events, chunks, audio } = setup();
  audio();
  chunks[0].onended();
  assert.deepEqual(
    speechEvents(events).map((event) => event.active),
    [true],
  );
  provider.handleMessage({
    serverContent: { inputTranscription: { text: "background transcription" } },
  });
  assert.equal(
    events.some((event) => event.type === "state" && event.state === "thinking"),
    false,
  );
  audio();
  provider.handleMessage({ serverContent: { turnComplete: true } });
  assert.deepEqual(
    speechEvents(events).map((event) => event.active),
    [true],
  );
  chunks[1].onended();
  assert.deepEqual(
    speechEvents(events).map((event) => event.active),
    [true, false],
  );
  assert.deepEqual(
    events.filter((event) => event.type === "state").map((event) => event.state),
    ["speaking", "listening"],
  );
});
test("an explicit interruption stops playback and releases the avatar immediately", () => {
  const { provider, events, chunks, audio } = setup();
  audio();
  provider.handleMessage({ serverContent: { interrupted: true } });
  assert.equal(chunks[0].stopped, true);
  assert.equal(chunks[0].onended, null);
  assert.deepEqual(
    speechEvents(events).map((event) => event.active),
    [true, false],
  );
  audio();
  assert.deepEqual(
    speechEvents(events).map((event) => event.active),
    [true, false, true],
  );
});

test("a late tool response cannot overwrite newer manual changes or return stale context", async (t) => {
  const provider = new GeminiLiveProvider(),
    events = [],
    responses = [];
  provider.onEvent((event) => events.push(event));
  provider.session = {
    sendClientContent() {},
    sendToolResponse(response) {
      responses.push(response);
    },
  };
  provider.syncWorkspace({ version: 1 });
  let finish;
  t.mock.method(
    globalThis,
    "fetch",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const requested = provider.executeTool(
    "correction",
    "update_quantity",
    {},
    provider.generation,
    provider.uiRevision,
  );
  provider.syncWorkspace({ version: 3 });
  finish({
    ok: true,
    json: async () => ({ workspace: { version: 2 }, context: { version: 2 }, saved: true }),
  });
  await requested;
  assert.equal(provider.workspaceVersion, 3);
  assert.equal(responses[0].functionResponses[0].response.context.version, 3);
  assert.equal(
    events.some((event) => event.type === "workspace" && event.workspace.version === 2),
    false,
  );
});
test("an older UI snapshot cannot move the voice workspace version backwards", () => {
  const provider = new GeminiLiveProvider(),
    updates = [];
  provider.session = {
    sendClientContent(update) {
      updates.push(update);
    },
  };
  provider.syncWorkspace({ version: 3 });
  provider.syncWorkspace({ version: 2 });
  assert.equal(provider.workspaceVersion, 3);
  assert.equal(updates.length, 1);
});

test("acknowledgment audio plays during a slow tool and the result does not interrupt it", async (t) => {
  const { provider, events, chunks, audio } = setup();
  const responses = [];
  provider.session.sendToolResponse = (response) => responses.push(response);
  let finish;
  t.mock.method(globalThis, "fetch", () => new Promise((resolve) => (finish = resolve)));
  provider.handleMessage({
    toolCall: { functionCalls: [{ id: "lookup", name: "search_food", args: {} }] },
  });
  await Promise.resolve();
  audio();
  provider.handleMessage({
    serverContent: { outputTranscription: { text: "Got it, I'm finding the nutrition." } },
  });
  assert.equal(responses.length, 0);
  assert.equal(provider.currentState, "speaking");
  assert.equal(
    events.some((event) => event.type === "tool_state" && event.busy),
    true,
  );
  finish({ ok: true, json: async () => ({ status: "draft", saved: false }) });
  await provider.toolQueue;
  assert.equal(responses[0].functionResponses[0].scheduling, "WHEN_IDLE");
  assert.equal(responses[0].functionResponses[0].response.saved, false);
  assert.equal(chunks[0].stopped, undefined);
  assert.equal(provider.currentState, "speaking");
});

test("asynchronous tools still execute in order and report failures without success", async (t) => {
  const provider = new GeminiLiveProvider(),
    requests = [],
    responses = [];
  provider.session = { sendToolResponse: (response) => responses.push(response) };
  let finish;
  t.mock.method(globalThis, "fetch", async (_, options) => {
    const command = JSON.parse(options.body);
    requests.push(command);
    if (requests.length === 1) return new Promise((resolve) => (finish = resolve));
    return { ok: false, status: 502, json: async () => ({ error: "USDA unavailable" }) };
  });
  provider.handleMessage({
    toolCall: {
      functionCalls: [
        { id: "draft", name: "start_food_log", args: {} },
        { id: "lookup", name: "search_food", args: {} },
      ],
    },
  });
  await Promise.resolve();
  assert.equal(requests.length, 1);
  finish({ ok: true, json: async () => ({ workspace: { version: 1 }, saved: false }) });
  await provider.toolQueue;
  assert.deepEqual(
    requests.map((request) => request.expectedVersion),
    [0, 1],
  );
  assert.equal(responses[1].functionResponses[0].response.saved, false);
  assert.equal(responses[1].functionResponses[0].response.error, "USDA unavailable");
  assert.equal(responses[1].functionResponses[0].scheduling, "WHEN_IDLE");
});
