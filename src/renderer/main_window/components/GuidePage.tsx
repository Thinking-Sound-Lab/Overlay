import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { ArrowRight, Keyboard, Mic, Languages, Settings, CheckCircle } from "lucide-react";

interface GuidePageProps {
  onGuideComplete: () => void;
}

export const GuidePage: React.FC<GuidePageProps> = ({ onGuideComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hotkeyTested, setHotkeyTested] = useState(false);
  const [isTestActive, setIsTestActive] = useState(true);

  // Set up hotkey test mode when component mounts
  useEffect(() => {
    const startTest = async () => {
      try {
        await window.electronAPI.startHotkeyTest();
        console.log("[GuidePage] Hotkey test mode started");
      } catch (error) {
        console.error("[GuidePage] Failed to start hotkey test:", error);
      }
    };

    const handleHotkeyDetected = () => {
      console.log("[GuidePage] Hotkey detected!");
      setHotkeyTested(true);
      setIsTestActive(false);
    };

    // Start test mode
    startTest();
    
    // Listen for hotkey detection
    window.addEventListener('hotkey-detected', handleHotkeyDetected);

    // Cleanup on unmount
    return () => {
      window.electronAPI.endHotkeyTest().catch(console.error);
      window.removeEventListener('hotkey-detected', handleHotkeyDetected);
    };
  }, []);

  // Get platform-specific hotkey display
  const getHotkeyDisplay = () => {
    const platform = window.electronAPI.platform;
    if (platform === "darwin") {
      return { text: "⌥ + Space", readable: "Option + Space" };
    } else if (platform === "win32") {
      return { text: "Ctrl + Alt + Space", readable: "Ctrl + Alt + Space" };
    } else {
      return { text: "Not supported", readable: "Hotkey not supported on this platform" };
    }
  };

  const handleGetStarted = async () => {
    // Prevent navigation if hotkey test not completed
    if (!hotkeyTested) {
      return;
    }

    setIsLoading(true);
    try {
      // End test mode before completing onboarding
      await window.electronAPI.endHotkeyTest();
      await onGuideComplete();
    } finally {
      // Keep loading state briefly to show user feedback
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const steps = [
    {
      icon: <Keyboard className="h-8 w-8 text-gray-600" />,
      title: "Press the hotkey",
      description:
        "Use Option+Space (Mac) or Alt+Space (Windows) to start recording",
      detail: "The recording window will appear at the bottom of your screen",
    },
    {
      icon: <Mic className="h-8 w-8 text-green-600" />,
      title: "Speak clearly",
      description:
        "Talk normally into your microphone while the recording is active",
      detail:
        "You'll see a wave animation indicating your voice is being captured",
    },
    {
      icon: <Languages className="h-8 w-8 text-purple-600" />,
      title: "Get transcribed text",
      description: "Press the hotkey again to stop and process your speech",
      detail: "Text will be automatically inserted where your cursor is",
    },
    {
      icon: <Settings className="h-8 w-8 text-orange-600" />,
      title: "Customize settings",
      description: "Configure output mode, translation, and AI refinement",
      detail: "Access settings anytime from the main window",
    },
  ];

  return (
    <div className="flex-1 p-8 pb-16 max-w-4xl mx-auto relative">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          How to use Overlay
        </h1>
        <p className="text-gray-600">
          Get started with AI-powered voice dictation in 4 simple steps
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {steps.map((step, index) => (
          <Card key={index} className="relative">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    {step.icon}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-800 text-white text-sm font-bold rounded-full">
                      {index + 1}
                    </span>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </div>
                  <CardDescription className="text-base">
                    {step.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{step.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Tips */}
      <Card className="mb-8 bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            💡 Pro Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-gray-600 font-bold">•</span>
              <span>
                Speak at a normal pace - the AI works better with natural speech
                patterns
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600 font-bold">•</span>
              <span>
                For best accuracy, use a quiet environment and position your
                microphone properly
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600 font-bold">•</span>
              <span>
                Enable translation to speak in one language and get text in
                another
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600 font-bold">•</span>
              <span>Use AI refinement for improved grammar and formatting</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Interactive Hotkey Test */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Test Your Hotkey</CardTitle>
          <CardDescription>
            Press your hotkey to ensure it's working before proceeding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`p-6 rounded-lg border-2 transition-all duration-300 ${
            hotkeyTested 
              ? 'bg-green-50 border-green-200' 
              : isTestActive 
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="text-center">
              {hotkeyTested ? (
                <>
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    ✓ Hotkey Test Successful!
                  </h3>
                  <p className="text-green-700">
                    Great! Your hotkey is working correctly. You can now proceed to start using Overlay.
                  </p>
                </>
              ) : (
                <>
                  <Keyboard className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Press your hotkey to test
                  </h3>
                  <div className="mb-4">
                    <kbd className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg text-lg font-mono shadow-sm">
                      {getHotkeyDisplay().text}
                    </kbd>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Press <strong>{getHotkeyDisplay().readable}</strong> to test the recording hotkey
                  </p>
                </>
              )}
            </div>
          </div>
          
          {/* Additional info */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              💡 <strong>Tip:</strong> This hotkey will start and stop your voice recordings when using Overlay
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button 
          onClick={handleGetStarted} 
          size="lg" 
          className={`px-8 transition-all ${!hotkeyTested ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLoading || !hotkeyTested}
        >
          {isLoading ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
              Loading...
            </>
          ) : !hotkeyTested ? (
            <>
              Complete hotkey test first
              <Keyboard className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Get Started
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
