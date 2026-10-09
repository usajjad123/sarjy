/** Visual speech detection only. Never gates audio sent to Gemini. */
export class SpeechActivityDetector {
  private active = false;
  private candidateSince: number | null = null;
  private lastSpeechAt = 0;

  update(level: number, now: number): boolean {
    // Hysteresis: require a stronger signal to start than to stay active.
    if (this.active) {
      if (level >= 0.035) this.lastSpeechAt = now;
      else if (now - this.lastSpeechAt >= 450) this.reset();
    } else if (level >= 0.08) {
      this.candidateSince ??= now;
      if (now - this.candidateSince >= 100) {
        this.active = true;
        this.lastSpeechAt = now;
        this.candidateSince = null;
      }
    } else this.candidateSince = null;
    return this.active;
  }

  reset() {
    this.active = false;
    this.candidateSince = null;
    this.lastSpeechAt = 0;
  }
}
