import React, { useEffect, useRef, useState } from "react";
import { X, Pause } from "lucide-react";
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

const totalLevels = Array(8).fill(0);

export const RecordingWindow: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioConstraints, setAudioConstraints] = useState({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: SAMPLE_RATE,
    channelCount: 1,
    deviceId: { exact: "default" },
  });
  const [isProcessing, setIsProcessing] = useState(false);
  // processingStage state removed as it was unused
  const [hovered, setHovered] = useState(false);
  const [levels, setLevels] = useState<number[]>(totalLevels);
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

    if (startSoundRef.current) startSoundRef.current.volume = 0.8;
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

  // Click handlers for recording window interactions
  const handleExpandedClick = async () => {
    if (!isRecording && !isProcessing) {
      // Start recording when clicking on expanded window
      try {
        await window.electronAPI.recording.start();
      } catch (error) {
        console.error("Failed to start recording:", error);
      }
    }
  };

  const handleCancelRecording = async (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.stopPropagation(); // Prevent bubbling to parent
    if (isRecording) {
      // Cross button cancels recording without processing
      try {
        await window.electronAPI.recording.cancel();

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

        setIsRecording(false);
      } catch (error) {
        console.error("Failed to cancel recording:", error);
      }
    }
  };

  const handleStopRecording = async (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.stopPropagation(); // Prevent bubbling to parent
    if (isRecording) {
      // Stop recording and start processing
      try {
        await window.electronAPI.recording.stop();
      } catch (error) {
        console.error("Failed to stop recording:", error);
      }
    }
  };

  // Visual mic level updates - IMPROVED VERSION
  useEffect(() => {
    if (!isRecording) {
      setLevels(totalLevels); // Reset to minimum height
      return;
    }

    let animationId: number;

    // Wait a short time for analyser to be ready
    const startVisualization = () => {
      if (!analyserRef.current) {
        console.log("⚠️ Analyser not ready yet, retrying...");
        setTimeout(startVisualization, 100);
        return;
      }

      console.log(
        "🎵 Starting waveform visualization with analyser:",
        !!analyserRef.current
      );
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      console.log(
        "📊 Frequency bin count:",
        analyserRef.current.frequencyBinCount
      );

      const updateLevels = () => {
        if (!analyserRef.current || !isRecording) {
          console.log(
            "❌ Stopping animation - analyser:",
            !!analyserRef.current,
            "recording:",
            isRecording
          );
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);

        // Debug: Log first few values to verify data flow
        if (Math.random() < 0.01) {
          // Log occasionally
          console.log(
            "🎶 Audio data sample:",
            Array.from(dataArray.slice(0, 8))
          );
        }

        // Enhanced frequency band separation for more realistic wave patterns
        const binCount = dataArray.length;
        const bandsPerBar = Math.floor(binCount / 8);
        const frequencyBands: number[] = [];

        // Calculate average frequency for each band
        for (let band = 0; band < 8; band++) {
          const startBin = band * bandsPerBar;
          const endBin = Math.min(startBin + bandsPerBar, binCount);
          let bandSum = 0;
          let bandCount = 0;

          for (let i = startBin; i < endBin; i++) {
            bandSum += dataArray[i];
            bandCount++;
          }

          const bandAverage = bandCount > 0 ? bandSum / bandCount : 0;
          frequencyBands.push(bandAverage / 255); // Normalize to 0-1
        }

        // Calculate overall RMS for fallback
        let sum = 0;
        let nonZeroCount = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
          if (dataArray[i] > 0) nonZeroCount++;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedLevel = Math.min(rms / 128, 1);

        // Debug: Log audio levels occasionally
        if (Math.random() < 0.01) {
          console.log(
            "📈 Audio levels - RMS:",
            rms.toFixed(2),
            "Normalized:",
            normalizedLevel.toFixed(3),
            "Non-zero samples:",
            nonZeroCount
          );
        }

        setLevels((prevLevels) => {
          const baseHeight = 3;
          const maxHeight = 28;
          // Wave-like coefficients creating a natural audio waveform pattern (8 bars)
          const multipliers = [0.6, 0.8, 1.1, 1.4, 1.4, 1.1, 0.8, 0.6];

          const newLevels = multipliers.map((multiplier, index) => {
            // Use frequency band data for more accurate representation
            const bandLevel = frequencyBands[index] || normalizedLevel;
            // More sophisticated random variation with wave propagation
            const waveOffset = Math.sin(Date.now() * 0.003 + index * 0.5) * 0.1;
            const randomVariation = 0.8 + Math.random() * 0.4 + waveOffset;

            // Combine band-specific data with overall level and multiplier
            const combinedLevel = bandLevel * 0.7 + normalizedLevel * 0.3;
            const height =
              baseHeight +
              combinedLevel *
                (maxHeight - baseHeight) *
                multiplier *
                randomVariation;
            return Math.max(baseHeight, Math.min(maxHeight, height));
          });

          // Smoother transition with wave propagation effect
          return prevLevels.map((prev, i) => prev * 0.6 + newLevels[i] * 0.4);
        });

        animationId = requestAnimationFrame(updateLevels);
      };

      updateLevels();
    };

    startVisualization();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isRecording]);

  // Debug: Log whenever audioConstraints changes
  useEffect(() => {
    console.log("🎙️ audioConstraints state changed:", audioConstraints);
  }, [audioConstraints]);

  // Load microphone constraints from session state (no database)
  useEffect(() => {
    const loadCurrentMicrophoneConstraints = async () => {
      try {
        console.log("🎙️ Loading microphone constraints from session state");

        // Get constraints for current selected device from MicrophoneService
        const constraintsResult =
          await window.electronAPI.microphone.getCurrentDeviceConstraints();
        console.log(
          "🎙️ getCurrentDeviceConstraints result:",
          constraintsResult
        );

        if (constraintsResult.success && constraintsResult.data) {
          console.log("🎙️ constraintsResult.data:", constraintsResult.data);
          const newConstraints = constraintsResult.data.constraints;
          console.log("🎙️ Loaded constraints:", newConstraints);
          setAudioConstraints(newConstraints);
          console.log(
            "🎙️ Applied session microphone constraints:",
            newConstraints
          );
        } else {
          console.warn(
            "🎙️ Failed to get current device constraints, using defaults"
          );
        }
      } catch (error) {
        console.warn("🎙️ Failed to load microphone constraints:", error);
      }
    };

    // Listen for real-time device changes from tray/settings
    const handleMicrophoneChanged = async (event: any) => {
      const { deviceId } = event.detail || event;
      console.log("🎙️ Microphone device changed to:", deviceId);

      try {
        // Get new constraints for the selected device
        const constraintsResult =
          await window.electronAPI.microphone.getConstraints(deviceId);
        console.log("🎙️ Constraints result:", constraintsResult);
        if (constraintsResult.success && constraintsResult.data) {
          const newConstraints = constraintsResult.data.constraints;
          console.log("🎙️ Updated constraints:", newConstraints);
          setAudioConstraints(newConstraints);
          console.log(
            "🎙️ Applied new microphone constraints for device:",
            deviceId,
            "New constraints:",
            newConstraints
          );
        }
      } catch (error) {
        console.warn(
          "🎙️ Failed to update constraints for device:",
          deviceId,
          error
        );
      }
    };

    loadCurrentMicrophoneConstraints();
    window.addEventListener(
      "microphone-device-changed",
      handleMicrophoneChanged
    );

    return () => {
      window.removeEventListener(
        "microphone-device-changed",
        handleMicrophoneChanged
      );
    };
  }, []);

  // Start mic/audio streaming
  const startMediaRecording = async () => {
    try {
      setIsRecording(true);
      setIsProcessing(false);

      // Use pre-loaded microphone constraints for instant recording start
      console.log("🎙️ Starting recording with constraints:", audioConstraints);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      streamRef.current = stream;
      const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = micAudioContext;
      await micAudioContext.resume();

      // Create analyzer for visualization
      const analyser = micAudioContext.createAnalyser();
      analyser.fftSize = 512; // Increased for better frequency resolution
      analyser.smoothingTimeConstant = 0.3; // Reduced for more responsive visualization
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      console.log("🎙️ Audio context state:", micAudioContext.state);
      console.log("🎙️ Audio context sample rate:", micAudioContext.sampleRate);

      const micSource = micAudioContext.createMediaStreamSource(stream);
      console.log("📡 Media stream source created");

      const micProcessor = micAudioContext.createScriptProcessor(
        BUFFER_SIZE,
        1,
        1
      );

      // Connect audio nodes: source -> analyser -> processor -> destination
      micSource.connect(analyser);
      analyser.connect(micProcessor); // Connect analyser to processor for data flow
      micProcessor.connect(micAudioContext.destination);

      // Set analyser reference AFTER all connections are made
      analyserRef.current = analyser;

      console.log(
        "✅ Audio chain connected: source -> analyser -> processor -> destination"
      );
      console.log("✅ Analyser setup complete:", !!analyserRef.current);
      console.log(
        "🔊 FFT size:",
        analyser.fftSize,
        "Frequency bins:",
        analyser.frequencyBinCount
      );

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
      startMediaRecording();
      setWindowState("expanded");
    };
    const handleRecordingStopped = () => {
      playSound(stopSoundRef);
      setWindowState("processing"); // Keep expanded during processing
      stopMediaRecording();
    };
    const handleProcessingComplete = () => {
      setWindowState("compact");
      setIsProcessing(false);
    };

    const handleProcessingStage = () => {
      // Processing stage tracking removed as unused
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
  }, [isRecording, isProcessing, audioConstraints]);

  const expanded =
    hovered || isRecording || isProcessing || windowState === "processing";

  const getBaseContainerClasses = () => {
    return `
      relative overflow-hidden
      bg-black
      flex items-center justify-center
      transition-all duration-200 ease-[cubic-bezier(0.25,0.8,0.25,1)]
      transform-gpu
    `;
  };

  const getBorderClasses = () => {
    if (isRecording || isProcessing || windowState === "processing") {
      return "border border-gray-100/60"; // Reduced opacity for expanded states
    } else if (hovered) {
      return "border border-gray-100/60"; // Reduced opacity for hover
    } else {
      return "border border-white/90"; // More visible border for compact
    }
  };

  const getStateClasses = () => {
    if (isRecording) {
      return "w-full h-full rounded-3xl opacity-100"; // Smoother transition
    } else if (isProcessing || windowState === "processing") {
      return "w-full h-full rounded-3xl opacity-100"; // Smoother transition
    } else if (hovered) {
      return "w-full h-full rounded-3xl opacity-100"; // Smoother transition
    } else {
      return "w-[43px] h-full rounded-xl opacity-80";
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center">
      <div
        className={`
          ${getBaseContainerClasses()}
          ${getBorderClasses()}
          ${getStateClasses()}
          ${expanded && !isRecording && !isProcessing ? "cursor-pointer" : ""}
        `}
        onMouseEnter={async () => {
          setHovered(true);
          // Direct window control - expand window immediately
          await window.electronAPI.expandRecordingWindow();
          // Show tooltip when hovering over expanded window (not recording/processing)
          if (!isRecording && !isProcessing) {
            await window.electronAPI.showRecordingTooltip(
              "click-to-record",
              "Click to start recording"
            );
          }
        }}
        onMouseLeave={async () => {
          setHovered(false);
          // Only compact if not recording or processing
          if (!isRecording && !isProcessing) {
            await window.electronAPI.compactRecordingWindow();
          }
        }}
        onClick={handleExpandedClick}
      >
        {expanded && !isRecording && !isProcessing && (
          <div className="flex gap-1 items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-white/85 opacity-60" />
            <span className="w-1 h-1 rounded-full bg-white/85 opacity-60" />
            <span className="w-1 h-1 rounded-full bg-white/85 opacity-60" />
            <span className="w-1 h-1 rounded-full bg-white/85 opacity-60" />
            <span className="w-1 h-1 rounded-full bg-white/85 opacity-60" />
          </div>
        )}
        {isRecording && (
          <div className="flex items-center justify-between h-full w-full px-2">
            {/* Cancel (X) button on the left */}
            <div
              className="flex-shrink-0 cursor-pointer bg-white hover:bg-gray-100 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
              onClick={handleCancelRecording}
              title="Cancel recording"
              onMouseEnter={() =>
                window.electronAPI.showRecordingTooltip(
                  "cancel-recording",
                  "Cancel recording"
                )
              }
            >
              <X size={12} className="text-black" strokeWidth={2} />
            </div>

            {/* Waveform in the center */}
            <div className="flex items-center justify-center gap-[3px] flex-1 px-1 min-w-0">
              {levels.map((h, i) => (
                <span
                  key={i}
                  className="block w-2.5 min-h-1 bg-white/95 rounded-full transition-all duration-200 ease-out shadow-sm animate-wave-pulse"
                  style={{
                    height: `${Math.round(h)}px`,
                    opacity: 0.8 + (h / 28) * 0.2, // Dynamic opacity based on height
                    animationDelay: `${i * 100}ms`, // Staggered animation delay for wave effect
                    boxShadow: `0 0 ${Math.round(h / 4)}px rgba(255, 255, 255, ${0.3 + (h / 28) * 0.4})`, // Dynamic glow
                  }}
                />
              ))}
            </div>

            {/* Stop/Pause button on the right */}
            <div
              className="flex-shrink-0 cursor-pointer bg-red-500 hover:bg-red-600 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
              onClick={handleStopRecording}
              title="Stop recording and process"
              onMouseEnter={() =>
                window.electronAPI.showRecordingTooltip(
                  "process-recording",
                  "Process recording"
                )
              }
            >
              <Pause size={12} className="text-white" strokeWidth={2} />
            </div>
          </div>
        )}
        {isProcessing && (
          <div className="flex items-center justify-center w-full h-full">
            <div className="flex gap-1 items-center justify-center">
              <span className="w-1 h-1 rounded-full bg-white/85 opacity-60 animate-blink [animation-delay:0s]" />
              <span className="w-1 h-1 rounded-full bg-white/85 opacity-60 animate-blink [animation-delay:0.2s]" />
              <span className="w-1 h-1 rounded-full bg-white/85 opacity-60 animate-blink [animation-delay:0.4s]" />
              <span className="w-1 h-1 rounded-full bg-white/85 opacity-60 animate-blink [animation-delay:0.6s]" />
              <span className="w-1 h-1 rounded-full bg-white/85 opacity-60 animate-blink [animation-delay:0.8s]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
