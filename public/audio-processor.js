// Runs on the browser audio thread; sends microphone samples to the Gemini client.
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(1024);
    this.offset = 0;
  }

  process(inputs) {
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    for (const sample of samples) {
      this.buffer[this.offset++] = sample;
      if (this.offset === this.buffer.length) {
        this.port.postMessage(this.buffer);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
