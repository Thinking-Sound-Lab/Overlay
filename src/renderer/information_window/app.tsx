import React, { useState, useEffect } from "react";

interface InformationMessage {
  type:
    | "empty-transcript"
    | "silent-recording"
    | "permission-error"
    | "processing-error";
  title: string;
  message: string;
  duration?: number;
}

export const InformationWindow: React.FC = () => {
  const [message, setMessage] = useState<InformationMessage | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleShowMessage = (event: CustomEvent) => {
      const newMessage = event.detail as InformationMessage;
      setMessage(newMessage);
      setIsVisible(true);
      setProgress(0);
    };

    // Listen for messages from main process
    window.addEventListener("show-message", handleShowMessage as EventListener);

    return () => {
      window.removeEventListener(
        "show-message",
        handleShowMessage as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (isVisible && message) {
      const duration = message.duration || 3000;
      const interval = 16; // 60fps updates
      const steps = duration / interval;
      const increment = 100 / steps;
      
      const progressTimer = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + increment;
          if (newProgress >= 100) {
            clearInterval(progressTimer);
            setIsVisible(false);
            setTimeout(() => setMessage(null), 300);
            return 100;
          }
          return newProgress;
        });
      }, interval);

      return () => clearInterval(progressTimer);
    }
  }, [isVisible, message]);

  const getDisplayText = (type: string) => {
    switch (type) {
      case "empty-transcript":
      case "silent-recording":
        return "Transcript not found";
      case "permission-error":
        return "Permission error";
      case "processing-error":
        return "Processing error";
      default:
        return "Error occurred";
    }
  };

  if (!message) return null;

  return (
    <div className="h-screen w-screen">
      <div
        className={`
          relative w-full h-full bg-black rounded-lg overflow-hidden
          transform transition-all duration-300 ease-in-out
          ${isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}
        `}
      >
        {/* Main content */}
        <div className="flex items-center justify-center h-full px-4">
          <p className="text-white text-sm font-medium text-center">
            {getDisplayText(message.type)}
          </p>
        </div>
        
        {/* Progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
          <div 
            className="h-full bg-white transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
