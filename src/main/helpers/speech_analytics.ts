// helpers/speechAnalytics.ts
import { SpeechMetrics, GlobalMetrics } from "../../shared/types";

export function calculateSpeechMetrics(
  text: string,
  recordingDuration: number
): SpeechMetrics {
  // Count words (split by whitespace, filter empty strings)
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const wordCount = words.length;

  // Calculate WPM (words per minute)
  const durationInMinutes = recordingDuration / 60;
  const wordsPerMinute =
    durationInMinutes > 0 ? wordCount / durationInMinutes : 0;

  return {
    wordCount,
    wordsPerMinute,
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
