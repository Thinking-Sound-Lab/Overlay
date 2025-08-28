/**
 * Analytics Types
 * Interfaces for speech metrics and analytics tracking
 */

export interface SpeechMetrics {
  wordCount: number;
  wordsPerMinute: number;
  duration: number; // in seconds
}

export interface GlobalMetrics {
  totalWordCount: number;
  averageWPM: number;
  totalRecordings: number;
  lastRecordingWords: number;
  lastRecordingWPM: number;
  streakDays: number;
}