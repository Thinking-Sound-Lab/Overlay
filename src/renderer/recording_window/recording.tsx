import React, { useEffect, useRef, useState } from "react";
import "./index.css";
import startSound from "../../../assets/sounds/start.wav";
import stopSound from "../../../assets/sounds/stop.wav";

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 1024;
const AUDIO_CHUNK_DURATION = 0.1; // seconds

// Convert Float32Array (from Web Audio API) to Int16Array PCM
const convertFloat32ToInt16 = (buffer: Float32Array): Int16Array => {
  const int16Array = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
};

export const RecordingWindow: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [hovered, setHovered] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(8).fill(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const [windowState, setWindowState] = useState<
    "compact" | "expanded" | "processing"
  >("compact");
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const stopSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    startSoundRef.current = new Audio(startSound);
    stopSoundRef.current = new Audio(stopSound);

    if (startSoundRef.current) startSoundRef.current.volume = 0.2;
    if (stopSoundRef.current) stopSoundRef.current.volume = 0.2;

    return () => {
      startSoundRef.current = null;
      stopSoundRef.current = null;
    };
  }, []);

  const playSound = async (soundRef: React.RefObject<HTMLAudioElement>) => {
    try {
      if (soundRef.current) {
        soundRef.current.currentTime = 0; // Reset to start
        await soundRef.current.play();
      }
    } catch (error) {
      console.warn("Could not play sound:", error);
    }
  };

  // Visual mic level updates - IMPROVED VERSION
  useEffect(() => {
    if (!isRecording) {
      setLevels(Array(8).fill(4)); // Reset to minimum height
      return;
    }

    if (!analyserRef.current) {
      return;
    }

    let animationId: number;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const updateLevels = () => {
      if (!analyserRef.current || !isRecording) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate RMS (Root Mean Square) for better audio level detection
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalizedLevel = Math.min(rms / 100, 1); // Normalize to 0-1

      setLevels((prevLevels) => {
        const baseHeight = 4;
        const maxHeight = 22;
        const multipliers = [0.7, 0.9, 1.1, 1.3, 1.2, 1.0, 0.8, 0.6];

        const newLevels = multipliers.map(multiplier => {
          const randomVariation = 0.8 + Math.random() * 0.4;
          const height = baseHeight + (normalizedLevel * (maxHeight - baseHeight) * multiplier * randomVariation);
          return Math.max(baseHeight, Math.min(maxHeight, height));
        });

        // Smooth transition for more natural animation
        return prevLevels.map((prev, i) => prev * 0.7 + newLevels[i] * 0.3);
      });

      animationId = requestAnimationFrame(updateLevels);
    };

    animationId = requestAnimationFrame(updateLevels);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isRecording]);

  // Start mic/audio streaming
  const startMediaRecording = async () => {
    try {
      setIsRecording(true);
      setIsProcessing(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
        },
        video: false,
      });

      streamRef.current = stream;
      const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = micAudioContext;
      await micAudioContext.resume();

      // Create analyzer for visualization
      const analyser = micAudioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const micSource = micAudioContext.createMediaStreamSource(stream);

      const micProcessor = micAudioContext.createScriptProcessor(
        BUFFER_SIZE,
        1,
        1
      );

      // Connect analyzer to source
      micSource.connect(analyser);
      micSource.connect(micProcessor);
      micProcessor.connect(micAudioContext.destination);
      analyserRef.current = analyser;

      console.log("✅ Analyser setup complete:", !!analyserRef.current);

      const audioBuffer: number[] = [];
      const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;
      micProcessor.onaudioprocess = async (audioProcessingEvent) => {
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        while (audioBuffer.length >= samplesPerChunk) {
          const chunk = audioBuffer.splice(0, samplesPerChunk);
          const pcm16 = convertFloat32ToInt16(new Float32Array(chunk));
          const b64 = arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
          await window.electronAPI.audioRecorded({
            data: b64,
            mimeType: "audio/pcm;rate=16000",
          });
        }
      };

      audioProcessorRef.current = micProcessor;
    } catch (err) {
      console.error("Error starting media recording:", err);
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const stopMediaRecording = async () => {
    try {
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }

      console.log("isRecording:", isRecording);
      if (isRecording) {
        console.log("setting processing to true");
        setIsProcessing(true);
      }
      setIsRecording(false);
    } catch (err) {
      console.error("Error stopping media recording:", err);
      setIsProcessing(false);
      setWindowState("compact");
    }
  };

  // IPC events from main
  useEffect(() => {
    const handleRecordingStarted = () => {
      playSound(startSoundRef);
      setWindowState("expanded");
      startMediaRecording();
    };
    const handleRecordingStopped = () => {
      playSound(stopSoundRef);
      setWindowState("processing"); // Keep expanded during processing
      stopMediaRecording();
    };
    const handleProcessingComplete = () => {
      setWindowState("compact");
      setIsProcessing(false);
      setProcessingStage("");
    };

    const handleProcessingStage = (event: any) => {
      const stage = event.detail;
      setProcessingStage(typeof stage === 'string' ? stage : stage.toString());
      setIsProcessing(true);
      setWindowState("processing"); // Ensure window stays expanded
    };

    window.addEventListener("recording-started", handleRecordingStarted);
    window.addEventListener("recording-stopped", handleRecordingStopped);
    window.addEventListener("processing-complete", handleProcessingComplete);
    window.addEventListener("processing-stage", handleProcessingStage);

    return () => {
      window.removeEventListener("recording-started", handleRecordingStarted);
      window.removeEventListener("recording-stopped", handleRecordingStopped);
      window.removeEventListener(
        "processing-complete",
        handleProcessingComplete
      );
      window.removeEventListener("processing-stage", handleProcessingStage);
    };
  }, [isRecording, isProcessing]);

  const expanded = hovered || isRecording || isProcessing || windowState === "processing";

  const getContainerClass = () => {
    let stateClass = "";
    
    if (isRecording) {
      stateClass = "recording";
    } else if (isProcessing || windowState === "processing") {
      stateClass = "processing";
    } else if (hovered) {
      stateClass = "hovered";
    }
    
    return [
      "recording-container",
      stateClass,
      isRecording ? "recording" : "",
      hovered ? "hovered" : "",
      isProcessing ? "processing" : "",
    ].join(" ");
  };

  return (
    <div className="window-container">
      <div
        className={getContainerClass()}
        onMouseEnter={() => {
          setHovered(true);
          window.electronAPI.windowHoverEnter();
        }}
        onMouseLeave={() => {
          setHovered(false);
          window.electronAPI.windowHoverLeave();
        }}
      >
        {expanded && !isRecording && !isProcessing && (
          <div className="dots">
            <span />
            <span />
            <span />
          </div>
        )}
        {isRecording && (
          <div className="wave">
            {levels.map((h, i) => (
              <span
                key={i}
                style={{
                  height: `${Math.round(h)}px`,
                  transition: "height 0.15s ease-out",
                }}
              />
            ))}
          </div>
        )}
        {isProcessing && (
          <div className="processing">
            <div className="processing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            {processingStage && (
              <div className="processing-stage">{processingStage}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
