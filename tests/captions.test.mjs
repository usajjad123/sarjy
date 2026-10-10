import assert from "node:assert/strict";
import test from "node:test";

import { compile, moduleURL as dataModule } from "./helpers/typescript.mjs";

const { LiveInputTranscriber } = await import(
  compile("../src/lib/realtime/gemini/LiveInputTranscriber.ts", {
    "@google/genai": dataModule("export class GoogleGenAI {}"),
    "./transcription-config": dataModule('export const TRANSCRIPTION_MODEL = "test";'),
  })
);

test("interim hypotheses replace previous text, then finalize without duplicate words", () => {
  const results = [];
  const transcriber = new LiveInputTranscriber(
    (text, interim) => results.push({ text, interim }),
    () => {},
  );
  transcriber.handleMessage({
    serverContent: { interimInputTranscription: { text: "I ate rice" } },
  });
  transcriber.handleMessage({
    serverContent: { interimInputTranscription: { text: "I ate ripe fruit" } },
  });
  transcriber.handleMessage({
    serverContent: { inputTranscription: { text: "I ate ripe fruit." } },
  });
  assert.deepEqual(results.at(-1), { text: "I ate ripe fruit.", interim: false });
  assert.equal(results[1].text, "I ate ripe fruit");
  transcriber.resetUtterance();
  transcriber.handleMessage({
    serverContent: { interimInputTranscription: { text: "And yogurt" } },
  });
  assert.equal(results.at(-1).text, "And yogurt");
});

test("a failed caption socket stops its stream and reports fallback without throwing into the mic loop", () => {
  let unavailable = 0,
    closed = 0;
  const transcriber = new LiveInputTranscriber(
    () => {},
    () => unavailable++,
  );
  transcriber.session = {
    sendRealtimeInput() {
      throw new Error("Socket closed");
    },
    close() {
      closed++;
    },
  };
  assert.doesNotThrow(() => transcriber.sendAudio("AAAA", 16000));
  transcriber.sendAudio("AAAA", 16000);
  assert.equal(unavailable, 1);
  assert.equal(closed, 1);
});
