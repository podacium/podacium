/**
 * AudioWorkletProcessor: pcm-player-processor
 *
 * Jitter buffer queue for smooth 24kHz PCM playback with instantaneous buffer flushing
 * on barge-in / interruption to ensure zero latency cutoff.
 */

class PcmPlayerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.inputSampleRate = options?.processorOptions?.inputSampleRate || 24000; // Gemini Live default
    this.outputSampleRate = sampleRate; // Web Audio context sample rate

    // Ring / Jitter FIFO buffer holding Float32 samples ready for output at this.outputSampleRate
    this.bufferCapacity = this.outputSampleRate * 10; // Max 10 seconds capacity
    this.buffer = new Float32Array(this.bufferCapacity);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.bufferedSamples = 0;

    // Resampling ratio & state
    this.resampleRatio = this.inputSampleRate / this.outputSampleRate;
    this.resampleFrac = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      const type = data.type || data.event;

      if (type === "flush" || type === "interrupt" || type === "clear") {
        this.flush();
      } else if (type === "audio" || type === "pcm" || data.buffer) {
        const rawBuffer = data.buffer || data;
        const srcRate = data.sampleRate || this.inputSampleRate;
        this.enqueueInt16Pcm(rawBuffer, srcRate);
      } else if (type === "config") {
        if (data.inputSampleRate) {
          this.inputSampleRate = data.inputSampleRate;
          this.resampleRatio = this.inputSampleRate / this.outputSampleRate;
        }
      }
    };
  }

  /**
   * Instantly flush the jitter buffer on interruption/barge-in
   */
  flush() {
    this.writeIndex = 0;
    this.readIndex = 0;
    this.bufferedSamples = 0;
    this.resampleFrac = 0;
    this.port.postMessage({ event: "flushed" });
  }

  /**
   * Convert Int16 PCM at srcSampleRate and resample into internal Float32 buffer
   */
  enqueueInt16Pcm(arrayBuffer, srcSampleRate) {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) return;

    const int16View = new Int16Array(
      arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer,
      arrayBuffer.byteOffset || 0,
      (arrayBuffer.byteLength || arrayBuffer.buffer.byteLength) / 2,
    );

    const inLen = int16View.length;
    if (inLen === 0) return;

    // Resample from srcSampleRate to outputSampleRate
    const ratio = srcSampleRate / this.outputSampleRate;
    let inPos = this.resampleFrac;

    while (inPos < inLen) {
      if (this.bufferedSamples >= this.bufferCapacity) {
        // Buffer full, drop oldest samples or stop
        break;
      }

      const idx0 = Math.floor(inPos);
      const frac = inPos - idx0;
      const s0 = int16View[idx0] / 32768.0;
      const s1 = idx0 + 1 < inLen ? int16View[idx0 + 1] / 32768.0 : s0;
      const sample = s0 + frac * (s1 - s0);

      this.buffer[this.writeIndex] = sample;
      this.writeIndex = (this.writeIndex + 1) % this.bufferCapacity;
      this.bufferedSamples++;

      inPos += ratio;
    }

    this.resampleFrac = inPos - inLen;
  }

  process(_inputs, outputs, _parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channel0 = output[0];
    const frameCount = channel0.length;

    for (let i = 0; i < frameCount; i++) {
      if (this.bufferedSamples > 0) {
        const sample = this.buffer[this.readIndex];
        channel0[i] = sample;
        this.readIndex = (this.readIndex + 1) % this.bufferCapacity;
        this.bufferedSamples--;
      } else {
        channel0[i] = 0; // Silence on buffer underrun
      }
    }

    // Mirror mono channel to other channels (stereo, 5.1, etc.)
    for (let c = 1; c < output.length; c++) {
      output[c].set(channel0);
    }

    // Periodically notify main thread of low/empty buffer
    if (this.bufferedSamples === 0) {
      this.port.postMessage({ event: "underrun" });
    }

    return true;
  }
}

registerProcessor("pcm-player-processor", PcmPlayerProcessor);
