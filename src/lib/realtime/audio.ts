export function float32ToPCM16(input: Float32Array) {
    const output = new Int16Array(input.length);
  
    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
  
      output[i] =
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff;
    }
  
    return output;
  }
  
  export function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
  
    let binary = "";
  
    const chunkSize = 0x8000;
  
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(
        i,
        Math.min(i + chunkSize, bytes.length)
      );
  
      binary += String.fromCharCode(...chunk);
    }
  
    return btoa(binary);
  }