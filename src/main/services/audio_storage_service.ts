import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { SupabaseService } from "./supabase_service";
import { addWavHeader, combineAudioChunks } from "../providers/openai";

export interface AudioUploadResult {
  success: boolean;
  audioFilePath?: string;
  error?: string;
}

export interface AudioDownloadProgress {
  transcriptId: string;
  progress: number;
  status: "downloading" | "complete" | "error";
  error?: string;
}

export class AudioStorageService {
  private readonly bucketName = "audio-recordings";
  private tempAudioBuffer: Buffer | null = null;

  constructor(private supabaseService: SupabaseService) {

  }

  async initialize(): Promise<void> {
    console.log("[AudioStorageService] Initializing audio storage service...");

    // Configure ffmpeg with proper path resolution
    let resolvedFfmpegPath = ffmpegPath;

    // Check if the bundled path exists, if not fall back to node_modules path
    if (ffmpegPath && !fs.existsSync(ffmpegPath)) {
      const fallbackPath = path.join(
        __dirname,
        "../../node_modules/ffmpeg-static/ffmpeg"
      );
      if (fs.existsSync(fallbackPath)) {
        resolvedFfmpegPath = fallbackPath;
        console.log(
          "[AudioStorage] Bundled ffmpeg not found, using fallback path:",
          fallbackPath
        );
      } else {
        resolvedFfmpegPath = null;
        console.warn(
          "[AudioStorage] Neither bundled nor fallback ffmpeg paths exist"
        );
      }
    }

    if (resolvedFfmpegPath) {
      ffmpeg.setFfmpegPath(resolvedFfmpegPath);
      console.log("[AudioStorage] Using ffmpeg binary at:", resolvedFfmpegPath);
    } else {
      console.warn(
        "[AudioStorage] No ffmpeg binary found, falling back to system PATH"
      );
    }
  }

  async stop(): Promise<void> {
    console.log("[AudioStorageService] Stopping audio storage service...");
    // Clear temp audio on stop
    this.clearTempAudio();
  }

  async dispose(): Promise<void> {
    console.log("[AudioStorageService] Disposing audio storage service...");
    // Clean up any resources
    this.clearTempAudio();
  }

  storeTempAudio(audioChunks: string[]): void {
    console.log("[AudioStorage] Storing temporary audio for later upload");
    // Combine and process audio chunks, add WAV header
    const combinedAudio = combineAudioChunks(audioChunks);
    this.tempAudioBuffer = addWavHeader(combinedAudio);
  }

  clearTempAudio(): void {
    this.tempAudioBuffer = null;
  }

  async uploadStoredAudio(userId: string, transcriptId: string): Promise<AudioUploadResult> {
    if (!this.tempAudioBuffer) {
      return { success: false, error: "No temporary audio stored" };
    }

    try {
      console.log("[AudioStorage] Uploading stored audio for transcript:", transcriptId);
      const result = await this.uploadAudio(userId, transcriptId, this.tempAudioBuffer);
      
      // Clear temp audio after upload attempt (success or failure)
      this.clearTempAudio();
      
      return result;
    } catch (error) {
      this.clearTempAudio();
      console.error("[AudioStorage] Upload stored audio exception:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async convertWavToM4a(audioBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempWavPath = path.join(os.tmpdir(), `temp_${Date.now()}.wav`);
      const tempM4aPath = path.join(os.tmpdir(), `temp_${Date.now()}.m4a`);

      try {
        // Add WAV header to raw audio data
        const wavBuffer = addWavHeader(audioBuffer);
        fs.writeFileSync(tempWavPath, wavBuffer);

        ffmpeg(tempWavPath)
          .audioBitrate(128)
          .audioCodec("aac")
          .format("mp4")
          .output(tempM4aPath)
          .on("end", () => {
            try {
              const m4aBuffer = fs.readFileSync(tempM4aPath);

              fs.unlinkSync(tempWavPath);
              fs.unlinkSync(tempM4aPath);

              resolve(m4aBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on("error", (err) => {
            try {
              fs.unlinkSync(tempWavPath);
              if (fs.existsSync(tempM4aPath)) fs.unlinkSync(tempM4aPath);
            } catch (cleanupError) {
              console.warn("[AudioStorage] Cleanup error:", cleanupError);
            }
            reject(err);
          })
          .run();
      } catch (error) {
        try {
          if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
          if (fs.existsSync(tempM4aPath)) fs.unlinkSync(tempM4aPath);
        } catch (cleanupError) {
          console.warn("[AudioStorage] Cleanup error:", cleanupError);
        }
        reject(error);
      }
    });
  }

  async uploadAudio(
    userId: string,
    transcriptId: string,
    audioBuffer: Buffer
  ): Promise<AudioUploadResult> {
    try {
      console.log(
        "[AudioStorage] Starting audio upload for transcript:",
        transcriptId
      );

      const m4aBuffer = await this.convertWavToM4a(audioBuffer);
      const fileName = `${userId}/${transcriptId}_${Date.now()}.m4a`;

      const { error } = await this.supabaseService
        .getClient()
        .storage.from(this.bucketName)
        .upload(fileName, m4aBuffer, {
          contentType: "audio/mp4",
          duplex: "half",
        });

      if (error) {
        console.error("[AudioStorage] Upload error:", error);
        return { success: false, error: error.message };
      }

      console.log("[AudioStorage] Upload successful:", fileName);
      return { success: true, audioFilePath: fileName };
    } catch (error) {
      console.error("[AudioStorage] Upload exception:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async downloadAudio(audioFilePath: string): Promise<Buffer> {
    const { data, error } = await this.supabaseService
      .getClient()
      .storage.from(this.bucketName)
      .download(audioFilePath);

    if (error) {
      throw new Error(`Failed to download audio: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async deleteAudio(audioFilePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .storage.from(this.bucketName)
        .remove([audioFilePath]);

      if (error) {
        console.error("[AudioStorage] Delete error:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[AudioStorage] Delete exception:", error);
      return false;
    }
  }

  getAudioUrl(audioFilePath: string): string {
    const { data } = this.supabaseService
      .getClient()
      .storage.from(this.bucketName)
      .getPublicUrl(audioFilePath);

    return data.publicUrl;
  }
}
