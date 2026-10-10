import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "./helpers/typescript.mjs";

const { SpeechActivityDetector } = await import(compile("../src/lib/realtime/speech-activity.ts"));

const startSpeaking = (detector) => {
  assert.equal(detector.update(0.2, 0), false);
  assert.equal(detector.update(0.2, 120), true);
};

test("room noise and an isolated mic click do not start the avatar", () => {
  const detector = new SpeechActivityDetector();
  for (let now = 0; now <= 1000; now += 40) assert.equal(detector.update(0.04, now), false);
  assert.equal(detector.update(0.9, 1040), false);
  assert.equal(detector.update(0, 1080), false);
  assert.equal(detector.update(0, 1800), false);
});
test("silence between words preserves speech until a real pause", () => {
  const detector = new SpeechActivityDetector();
  startSpeaking(detector);
  assert.equal(detector.update(0, 160), true);
  assert.equal(detector.update(0, 400), true);
  assert.equal(detector.update(0.1, 440), true);
  assert.equal(detector.update(0, 800), true);
  assert.equal(detector.update(0, 920), false);
});
test("a quiet continuation stays active and mute resets immediately", () => {
  const detector = new SpeechActivityDetector();
  startSpeaking(detector);
  assert.equal(detector.update(0.04, 400), true);
  assert.equal(detector.update(0.04, 800), true);
  detector.reset();
  assert.equal(detector.update(0, 820), false);
  assert.equal(detector.update(0.2, 840), false);
});
