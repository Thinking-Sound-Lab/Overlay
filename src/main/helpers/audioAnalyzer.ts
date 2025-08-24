// helpers/audioAnalyzer.ts

const VOLUME_THRESHOLD = 300; // Minimum average volume
const PEAK_THRESHOLD = 1000; // Minimum peak volume
const SPEECH_RATIO_THRESHOLD = 0.1; // Minimum ratio of non-silent samples

export function analyzeAudioSilence(audioBuffer: Buffer): {
  isSilent: boolean;
  averageVolume: number;
  peakVolume: number;
} {
  // Convert buffer to 16-bit PCM samples
  const samples = new Int16Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.length / 2
  );

  let sum = 0;
  let peak = 0;
  let nonZeroSamples = 0;

  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    sum += abs;
    peak = Math.max(peak, abs);
    if (abs > VOLUME_THRESHOLD) nonZeroSamples++; // Threshold for non-silence
  }

  const averageVolume = sum / samples.length;
  const peakVolume = peak;
  const speechRatio = nonZeroSamples / samples.length;

  // Determine if silent based on multiple criteria
  const isSilent =
    averageVolume < VOLUME_THRESHOLD ||
    peakVolume < PEAK_THRESHOLD ||
    speechRatio < SPEECH_RATIO_THRESHOLD;

  console.log(
    "[Audio Analysis] Average:",
    averageVolume,
    "Peak:",
    peakVolume,
    "Speech ratio:",
    speechRatio.toFixed(3)
  );

  return { isSilent, averageVolume, peakVolume };
}
