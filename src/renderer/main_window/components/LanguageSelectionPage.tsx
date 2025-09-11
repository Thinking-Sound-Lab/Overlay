import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Check, Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../../../shared/constants/languages";

interface LanguageSelectionPageProps {
  onLanguageSelected: (languageCode: string) => void;
}

export const LanguageSelectionPage: React.FC<LanguageSelectionPageProps> = ({
  onLanguageSelected,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const languages = SUPPORTED_LANGUAGES;

  const handleContinue = async () => {
    if (!selectedLanguage) return;
    
    setIsLoading(true);
    try {
      await onLanguageSelected(selectedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <Card className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gray-100 rounded-full">
                <Globe className="h-8 w-8 text-gray-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Choose Your Language
            </h1>
            <p className="text-gray-600 max-w-md mx-auto">
              Select your preferred language for speech recognition. This will be used for all your voice input.
            </p>
          </div>

          {/* Language Grid */}
          <div className="max-h-96 overflow-y-auto mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => setSelectedLanguage(language.code)}
                  className={`p-4 rounded-lg border-2 text-left transition-all hover:border-gray-300 hover:bg-gray-50 ${
                    selectedLanguage === language.code
                      ? "border-gray-500 bg-gray-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {language.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {language.nativeName}
                      </div>
                    </div>
                    {selectedLanguage === language.code && (
                      <Check className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              You can change this later in settings
            </div>
            <Button
              onClick={handleContinue}
              disabled={!selectedLanguage || isLoading}
              className="px-8 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Continue"}
            </Button>
          </div>
        </Card>

        {/* Progress indicator */}
        <div className="flex justify-center mt-6">
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};