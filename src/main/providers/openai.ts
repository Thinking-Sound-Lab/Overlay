// providers/openai.ts - Main Process
import fs from "fs";
import path from "path";
import os from "os";
import OpenAI from "openai";
import { analyzeAudioSilence } from "../helpers/audioAnalyzer";
import { config } from "../../../config/environment";

export const openai = new OpenAI({
  apiKey: config.openaiApiKey,
  timeout: 60000,
  maxRetries: 3,
});

export interface STTClient {
  processAudio: (audioChunks: string[]) => Promise<void>;
  close: () => void;
}

interface STTCallback {
  onmessage: (data: any) => void;
  onerror: (error: Error) => void;
  onclose: () => void;
}

export async function createWhisperSTT({
  language,
  callback,
}: {
  language: string;
  callback: STTCallback;
}): Promise<STTClient> {
  const processAudio = async (audioChunks: string[]) => {
    try {
      // Combine audio chunks into a single buffer
      const combinedAudio = combineAudioChunks(audioChunks);

      const audioAnalysis = analyzeAudioSilence(combinedAudio);

      if (audioAnalysis.isSilent) {
        console.log("[STT] Audio is silent, skipping transcription");
        return;
      }

      // Create temporary file for Whisper API
      const tempAudioPath = await createTempAudioFile(combinedAudio);

      // Transcribe with Whisper
      const result = await transcribeWithWhisper(
        tempAudioPath,
        openai,
        language
      );

      console.log("[STT] Transcription result:", result);
      console.log("[STT] Transcription language:", result.language);

      // Clean up temp file
      fs.unlinkSync(tempAudioPath);

      // Send result via callback
      callback.onmessage({
        type: "transcription.completed",
        transcript: result.text,
        language: result.language || "en",
        isFinal: true,
      });
    } catch (error) {
      console.error("[STT] Error processing audio:", error);
      callback.onerror(error as Error);
    }
  };

  return {
    processAudio,
    close: () => {
      callback.onclose();
    },
  };
}

function combineAudioChunks(audioChunks: string[]): Buffer {
  // Convert base64 chunks to buffers and combine
  const buffers = audioChunks.map((chunk) => Buffer.from(chunk, "base64"));
  return Buffer.concat(buffers);
}

async function createTempAudioFile(audioBuffer: Buffer): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `audio_${Date.now()}.wav`);

  // Add WAV header for proper format
  const wavBuffer = addWavHeader(audioBuffer);
  fs.writeFileSync(tempFilePath, wavBuffer);

  return tempFilePath;
}

function addWavHeader(audioBuffer: Buffer): Buffer {
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

// Updated function using OpenAI SDK
async function transcribeWithWhisper(
  audioFilePath: string,
  openaiClient: OpenAI,
  language: string
): Promise<{ text: string; language: string }> {
  try {
    const transcription = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),

      model: "gpt-4o-mini-transcribe",
      language: language === "auto" ? undefined : language,
      response_format: "json",
      temperature: 0.0, // Lower temperature for more consistent results
      prompt: `This is the audio of a person dictating something. The audio is in ${getLanguagePrompt(language)}. If there is no speech, return empty.`,
    });

    return {
      text: transcription.text || "",
      language: language,
    };
  } catch (error) {
    console.error("[STT] Whisper transcription error:", error);
    throw new Error(`Whisper transcription failed: ${error}`);
  }
}

// Helper function for language-specific prompts
function getLanguagePrompt(language: string): string {
  const prompts: Record<string, string> = {
    hi: "यह हिंदी में बोला गया है।",
    ur: "یہ اردو میں بولا گیا ہے۔",
    en: "This is spoken in English.",
    es: "Esto se habla en español.",
    fr: "Ceci est parlé en français.",
    ta: "இது தமிழில் பேசப்படுகிறது.",
    te: "ఇది తెలుగులో మాట్లాడబడింది.",
    bn: "এটি বাংলায় বলা হয়েছে।",
    gu: "આ ગુજરાતીમાં બોલવામાં આવ્યું છે.",
    kn: "ಇದು ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಲಾಗಿದೆ.",
    ml: "ഇത് മലയാളത്തിൽ സംസാരിച്ചിരിക്കുന്നു.",
    pa: "ਇਹ ਪੰਜਾਬੀ ਵਿੱਚ ਬੋਲਿਆ ਗਿਆ ਹੈ।",
    // Add more languages as needed
  };

  return prompts[language] || "";
}
