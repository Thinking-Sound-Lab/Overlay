// providers/openai.ts - Main Process
import OpenAI from "openai";

// Lazy initialization to prevent crashes during module import
let _openai: OpenAI | null = null;
let _defaultOpenAI: OpenAI | null = null;

export const getOpenAI = (): OpenAI => {
  if (!_openai) {
    const apiKey = process.env.BASETEN_API_KEY;
    if (!apiKey) {
      throw new Error("BASETEN_API_KEY environment variable is missing or empty");
    }
    _openai = new OpenAI({
      apiKey,
      timeout: 60000,
      maxRetries: 3,
      baseURL: "https://inference.baseten.co/v1",
    });
    console.log("[OpenAI] Baseten OpenAI client initialized");
  }
  return _openai;
};

export const getDefaultOpenAI = (): OpenAI => {
  if (!_defaultOpenAI) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is missing or empty");
    }
    _defaultOpenAI = new OpenAI({
      apiKey,
      timeout: 60000,
      maxRetries: 3,
    });
    console.log("[OpenAI] Default OpenAI client initialized");
  }
  return _defaultOpenAI;
};

// Backward compatibility exports (deprecated - use getters instead)
export const openai = getOpenAI;
export const defaultOpenAI = getDefaultOpenAI;


export function combineAudioChunks(audioChunks: string[]): Buffer {
  // Convert base64 chunks to buffers and combine
  const buffers = audioChunks.map((chunk) => Buffer.from(chunk, "base64"));
  const combinedBuffer = Buffer.concat(buffers);
  
  // Apply audio gain amplification for better recognition of quiet speech
  return amplifyAudioGain(combinedBuffer);
}

function amplifyAudioGain(audioBuffer: Buffer, gainFactor = 2.0): Buffer {
  // Convert buffer to 16-bit signed integers for audio processing
  const samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength / 2);
  const amplifiedSamples = new Int16Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    // Apply gain with clipping to prevent distortion
    let amplifiedSample = samples[i] * gainFactor;
    
    // Clip to prevent overflow (16-bit signed range: -32768 to 32767)
    if (amplifiedSample > 32767) {
      amplifiedSample = 32767;
    } else if (amplifiedSample < -32768) {
      amplifiedSample = -32768;
    }
    
    amplifiedSamples[i] = Math.round(amplifiedSample);
  }

  // Convert back to Buffer
  return Buffer.from(amplifiedSamples.buffer);
}


export function addWavHeader(audioBuffer: Buffer): Buffer {
  const header = Buffer.alloc(44);

  // WAV header
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + audioBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(16000, 24); // Sample rate
  header.writeUInt32LE(32000, 28); // Byte rate
  header.writeUInt16LE(2, 32); // Block align
  header.writeUInt16LE(16, 34); // Bits per sample
  header.write("data", 36);
  header.writeUInt32LE(audioBuffer.length, 40);

  return Buffer.concat([header, audioBuffer]);
}

