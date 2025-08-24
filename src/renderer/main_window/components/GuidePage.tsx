import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ArrowRight, Keyboard, Mic, Languages, Settings } from 'lucide-react';

interface GuidePageProps {
  onGuideComplete: () => void;
}

export const GuidePage: React.FC<GuidePageProps> = ({ onGuideComplete }) => {
  const steps = [
    {
      icon: <Keyboard className="h-8 w-8 text-blue-600" />,
      title: 'Press the hotkey',
      description: 'Use Option+Space (Mac) or Alt+Space (Windows) to start recording',
      detail: 'The recording window will appear at the bottom of your screen'
    },
    {
      icon: <Mic className="h-8 w-8 text-green-600" />,
      title: 'Speak clearly',
      description: 'Talk normally into your microphone while the recording is active',
      detail: 'You\'ll see a wave animation indicating your voice is being captured'
    },
    {
      icon: <Languages className="h-8 w-8 text-purple-600" />,
      title: 'Get transcribed text',
      description: 'Press the hotkey again to stop and process your speech',
      detail: 'Text will be automatically inserted where your cursor is'
    },
    {
      icon: <Settings className="h-8 w-8 text-orange-600" />,
      title: 'Customize settings',
      description: 'Configure output mode, translation, and AI refinement',
      detail: 'Access settings anytime from the main window'
    }
  ];

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto relative">
      {/* Draggable area at top */}
      <div 
        className="absolute top-0 left-0 right-0 h-8 z-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">How to use Overlay</h1>
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
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-sm font-bold rounded-full">
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
              <p className="text-sm text-gray-600">
                {step.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Tips */}
      <Card className="mb-8 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            💡 Pro Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Speak at a normal pace - the AI works better with natural speech patterns</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>For best accuracy, use a quiet environment and position your microphone properly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Enable translation to speak in one language and get text in another</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Use AI refinement for improved grammar and formatting</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Hotkey Reference */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Start/Stop Recording</span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-sm">
                {window.electronAPI.platform === 'darwin' ? '⌥' : 'Alt'} + Space
              </kbd>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Open Main Window</span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-sm">
                Click tray icon
              </kbd>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button 
          onClick={onGuideComplete}
          size="lg"
          className="px-8"
        >
          Get Started
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};