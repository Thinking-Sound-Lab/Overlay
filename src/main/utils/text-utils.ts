/**
 * Text utility functions for word counting and text processing
 */

/**
 * Count words in text, handling different languages appropriately
 * @param text The text to count words in
 * @returns Number of words in the text
 */
export function countWords(text: string): number {
  // Handle null, undefined, or empty strings
  if (!text || typeof text !== "string" || !text.trim()) {
    return 0;
  }

  try {
    // Handle different languages appropriately
    const cleanText = text
      .trim()
      .replace(
        /[^\w\s\u00C0-\u024F\u1E00-\u1EFF\u0100-\u017F\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
        " "
      );

    // For CJK characters, count each character as a word
    const cjkRegex = /[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/g;
    const cjkMatches = cleanText.match(cjkRegex);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;

    // For other languages, split by spaces
    const nonCjkText = cleanText.replace(cjkRegex, " ");
    const wordMatches = nonCjkText.match(/\S+/g);
    const wordCount = wordMatches ? wordMatches.length : 0;

    const totalWords = cjkCount + wordCount;

    // Ensure we never return negative numbers or NaN
    return isNaN(totalWords) || totalWords < 0 ? 0 : totalWords;
  } catch (error) {
    console.error("[TextUtils] Error counting words:", error);
    return 0; // Fallback to 0 on any error
  }
}