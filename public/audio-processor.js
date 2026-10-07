class AudioProcessor extends AudioWorkletProcessor {
    process(inputs) {
      const input = inputs[0];
  
      if (!input || !input[0]) {
        return true;
      }
  
      const samples = input[0];
  
      this.port.postMessage(samples);
  
      return true;
    }
  }
  
  registerProcessor("audio-processor", AudioProcessor);