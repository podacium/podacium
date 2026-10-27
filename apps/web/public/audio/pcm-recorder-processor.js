/**
 * AudioWorkletProcessor: pcm-recorder-processor
 *
 * Captures microphone audio in the rendering thread, downsamples from context sampleRate
 * to raw 16kHz mono PCM (Int16), and streams chunks via postMessage with zero DOM stutter.
 */

class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.targetSampleRate = 16000;
    this.bufferSize = options?.processorOptions?.bufferSize || 2048; // ~128ms at 16kHz
    this.isRecording = true;

    // Resampling state
    this.resampleRatio = sampleRate / this.targetSampleRate;
    this.resampleOffset = 0;

    // Internal accumulation buffer for 16kHz samples
    this.pcmBuffer = new Int16Array(this.bufferSize);
    this.bufferIndex = 0;

    this.port.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === "pause") {
        this.isRecording = false;
      } else if (type === "resume") {
        this.isRecording = true;
      } else if (type === "flush") {
        this.flushBuffer();
      } else if (type === "config" && payload?.bufferSize) {
        this.bufferSize = payload.bufferSize;
        this.pcmBuffer = new Int16Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    };
  }

  flushBuffer() {
    if (this.bufferIndex > 0) {
      const slice = this.pcmBuffer.slice(0, this.bufferIndex);
      this.port.postMessage(
        {
          event: "chunk",
          buffer: slice.buffer,
          sampleRate: this.targetSampleRate,
          channels: 1,
        },
        [slice.buffer],
      );
      this.bufferIndex = 0;
    }
  }

  process(inputs, _outputs, _parameters) {
    if (!this.isRecording) {
      return true;
    }

    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0];
    if (!channelData || channelData.length === 0) {
      return true;
    }

    // Downsample input to 16kHz using linear interpolation
    const inLength = channelData.length;
    let inIndex = this.resampleOffset;

    while (inIndex < inLength) {
      const idx = Math.floor(inIndex);
      const frac = inIndex - idx;
      const s0 = channelData[idx];
      const s1 = idx + 1 < inLength ? channelData[idx + 1] : s0;
      const interpolated = s0 + frac * (s1 - s0);

      // Clamp and convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
      const clamped = Math.max(-1, Math.min(1, interpolated));
      const int16Val = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.pcmBuffer[this.bufferIndex++] = Math.round(int16Val);

      // Check if chunk is ready
      if (this.bufferIndex >= this.bufferSize) {
        // Send chunk using transferable ArrayBuffer to avoid main-thread clone overhead
        const chunkToSend = new Int16Array(this.pcmBuffer);
        this.port.postMessage(
          {
            event: "chunk",
            buffer: chunkToSend.buffer,
            sampleRate: this.targetSampleRate,
            channels: 1,
          },
          [chunkToSend.buffer],
        );
        this.bufferIndex = 0;
      }

      inIndex += this.resampleRatio;
    }

    this.resampleOffset = inIndex - inLength;
    return true;
  }
}

registerProcessor("pcm-recorder-processor", PcmRecorderProcessor);
