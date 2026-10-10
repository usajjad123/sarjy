import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const dataModule = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const [name, url] of Object.entries(imports))
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return dataModule(outputText);
}
const { PlaybackCaptions, captionSegments } = await import(
  compile("../src/lib/realtime/captions.ts")
);
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

test("highlight follows the audio clock and remains until queued audio drains after turn completion", () => {
  const captions = new PlaybackCaptions();
  captions.append("One two three four.");
  captions.schedule(10, 14);
  assert.equal(captions.at(9, true).activeWord, -1);
  assert.equal(captions.at(10, true).activeWord, 0);
  captions.finish();
  assert.equal(captions.at(12.2, true).activeWord, 2);
  assert.equal(captions.at(13.2, true).activeWord, 3);
  assert.equal(captions.at(14, false).activeWord, -1);
});

test("late chunks cannot rewind the highlight and suspended audio has no active word", () => {
  const captions = new PlaybackCaptions();
  captions.append("One two three four");
  captions.schedule(0, 4);
  assert.equal(captions.at(2.1, true).activeWord, 2);
  captions.schedule(4, 9);
  captions.append(" five six");
  assert.equal(captions.at(2.2, true).activeWord, 2);
  assert.equal(captions.at(3, false).activeWord, -1);
});

test("word segmentation preserves punctuation and supports languages without spaces", () => {
  const text = "你好，世界！ Hello, 150 grams.";
  const segments = captionSegments(text);
  assert.equal(segments.map((s) => s.text).join(""), text);
  assert.deepEqual(
    segments.filter((s) => s.wordIndex !== null).map((s) => s.wordIndex),
    [0, 1, 2, 3, 4],
  );
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
