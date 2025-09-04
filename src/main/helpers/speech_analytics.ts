// helpers/speechAnalytics.ts
import { SpeechMetrics, GlobalMetrics } from "../../shared/types";

export function calculateSpeechMetrics(
  text: string,
  recordingDuration: number
): SpeechMetrics {
  // Input validation
  if (!text || typeof text !== "string") {
    console.warn("[Analytics] Invalid text input for metrics calculation:", text);
    return { wordCount: 0, wordsPerMinute: 0, duration: recordingDuration || 0 };
  }
  
  if (typeof recordingDuration !== "number" || recordingDuration < 0) {
    console.warn("[Analytics] Invalid recording duration for metrics calculation:", recordingDuration);
    recordingDuration = 0;
  }

  // Count words (split by whitespace, filter empty strings)
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const wordCount = words.length;

  // Calculate WPM (words per minute) with bounds checking
  const durationInMinutes = recordingDuration / 60;
  let wordsPerMinute = 0;
  
  if (durationInMinutes > 0) {
    wordsPerMinute = wordCount / durationInMinutes;
    
    // Sanity check - cap extremely high WPM values (likely calculation errors)
    if (wordsPerMinute > 1000) {
      console.warn(`[Analytics] Calculated WPM too high (${wordsPerMinute.toFixed(2)}), capping to 1000. Duration: ${recordingDuration}s, Words: ${wordCount}`);
      wordsPerMinute = 1000;
    }
  }

  console.log(`[Analytics] Calculated metrics: ${wordCount} words, ${recordingDuration}s duration, ${wordsPerMinute.toFixed(2)} WPM`);

  return {
    wordCount,
    wordsPerMinute: Math.round(wordsPerMinute * 100) / 100, // Round to 2 decimal places
    duration: recordingDuration,
  };
}

// GlobalMetrics interface now imported from shared types

export function updateGlobalMetrics(
  currentMetrics: GlobalMetrics,
  newWordCount: number,
  newWPM: number
): GlobalMetrics {
  const totalRecordings = currentMetrics.totalRecordings + 1;
  const totalWordCount = currentMetrics.totalWordCount + newWordCount;

  // Calculate weighted average WPM
  const averageWPM =
    totalRecordings === 1
      ? newWPM
      : (currentMetrics.averageWPM * (totalRecordings - 1) + newWPM) /
        totalRecordings;

  return {
    totalWordCount,
    averageWPM,
    totalRecordings,
    lastRecordingWords: newWordCount,
    lastRecordingWPM: newWPM,
    streakDays: currentMetrics.streakDays, // Preserve existing streak
  };
}
