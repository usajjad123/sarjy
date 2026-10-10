import type { VoiceCaption } from "./types";

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

export function captionSegments(text: string) {
  let index = 0;
  return [...segmenter.segment(text)].map((segment) => ({
    text: segment.segment,
    wordIndex: segment.isWordLike ? index++ : null,
  }));
}

export function userCaption(text: string, interim: boolean): VoiceCaption {
  const count = captionSegments(text).filter((segment) => segment.wordIndex !== null).length;
  return { speaker: "user", text, activeWord: interim ? count - 1 : -1, interim };
}

// Gemini Live has no word timestamps. Estimate progress against scheduled PCM
// playback, never network arrival time, and never rewind words when chunks arrive.
export class PlaybackCaptions {
  private text = "";
  private start: number | null = null;
  private end = 0;
  private cursor = -1;
  private finished = false;
  private wordCount = 0;

  append(text: string) {
    this.text += text;
    this.wordCount = captionSegments(this.text).filter((s) => s.wordIndex !== null).length;
  }

  schedule(start: number, end: number) {
    this.start ??= start;
    this.end = Math.max(this.end, end);
  }

  finish() {
    this.finished = true;
  }

  at(time: number, playing: boolean): VoiceCaption | null {
    if (!this.text) return null;
    let activeWord = -1;
    if (playing && this.start !== null && time >= this.start && time < this.end) {
      const progress = (time - this.start) / (this.end - this.start);
      this.cursor = Math.max(this.cursor, Math.floor(progress * this.wordCount));
      activeWord = Math.min(this.wordCount - 1, this.cursor);
    }
    return {
      speaker: "assistant",
      text: this.text,
      activeWord,
      interim: !this.finished,
    };
  }
}
