import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Check, Globe } from "lucide-react";

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  region?: string;
}

interface LanguageSelectionPageProps {
  onLanguageSelected: (languageCode: string) => void;
}

export const LanguageSelectionPage: React.FC<LanguageSelectionPageProps> = ({
  onLanguageSelected,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const languages: LanguageOption[] = [
    { code: "en", name: "English", nativeName: "English" },
    { code: "es", name: "Spanish", nativeName: "Español" },
    { code: "fr", name: "French", nativeName: "Français" },
    { code: "de", name: "German", nativeName: "Deutsch" },
    { code: "it", name: "Italian", nativeName: "Italiano" },
    { code: "pt", name: "Portuguese", nativeName: "Português" },
    { code: "ru", name: "Russian", nativeName: "Русский" },
    { code: "ja", name: "Japanese", nativeName: "日本語" },
    { code: "ko", name: "Korean", nativeName: "한국어" },
    { code: "zh", name: "Chinese", nativeName: "中文" },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
    { code: "ur", name: "Urdu", nativeName: "اردو" },
    { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
    { code: "te", name: "Telugu", nativeName: "తెలుగు" },
    { code: "bn", name: "Bengali", nativeName: "বাংলা" },
    { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
    { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
    { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
    { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
    { code: "ar", name: "Arabic", nativeName: "العربية" },
    { code: "he", name: "Hebrew", nativeName: "עברית" },
    { code: "th", name: "Thai", nativeName: "ไทย" },
    { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
    { code: "nl", name: "Dutch", nativeName: "Nederlands" },
    { code: "sv", name: "Swedish", nativeName: "Svenska" },
    { code: "no", name: "Norwegian", nativeName: "Norsk" },
    { code: "da", name: "Danish", nativeName: "Dansk" },
    { code: "fi", name: "Finnish", nativeName: "Suomi" },
    { code: "pl", name: "Polish", nativeName: "Polski" },
    { code: "cs", name: "Czech", nativeName: "Čeština" },
    { code: "hu", name: "Hungarian", nativeName: "Magyar" },
    { code: "ro", name: "Romanian", nativeName: "Română" },
    { code: "bg", name: "Bulgarian", nativeName: "Български" },
    { code: "hr", name: "Croatian", nativeName: "Hrvatski" },
    { code: "sk", name: "Slovak", nativeName: "Slovenčina" },
    { code: "sl", name: "Slovenian", nativeName: "Slovenščina" },
    { code: "et", name: "Estonian", nativeName: "Eesti" },
    { code: "lv", name: "Latvian", nativeName: "Latviešu" },
    { code: "lt", name: "Lithuanian", nativeName: "Lietuvių" },
    { code: "mt", name: "Maltese", nativeName: "Malti" },
    { code: "cy", name: "Welsh", nativeName: "Cymraeg" },
    { code: "ga", name: "Irish", nativeName: "Gaeilge" },
    { code: "is", name: "Icelandic", nativeName: "Íslenska" },
    { code: "mk", name: "Macedonian", nativeName: "Македонски" },
    { code: "sq", name: "Albanian", nativeName: "Shqip" },
    { code: "sr", name: "Serbian", nativeName: "Српски" },
    { code: "bs", name: "Bosnian", nativeName: "Bosanski" },
    { code: "tr", name: "Turkish", nativeName: "Türkçe" },
    { code: "fa", name: "Persian", nativeName: "فارسی" },
    { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
    { code: "af", name: "Afrikaans", nativeName: "Afrikaans" },
    { code: "am", name: "Amharic", nativeName: "አማርኛ" },
    { code: "az", name: "Azerbaijani", nativeName: "Azərbaycan" },
    { code: "be", name: "Belarusian", nativeName: "Беларуская" },
    { code: "ca", name: "Catalan", nativeName: "Català" },
    { code: "eu", name: "Basque", nativeName: "Euskera" },
    { code: "gl", name: "Galician", nativeName: "Galego" },
    { code: "ka", name: "Georgian", nativeName: "ქართული" },
    { code: "hy", name: "Armenian", nativeName: "Հայերեն" },
    { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
    { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
    { code: "tl", name: "Filipino", nativeName: "Filipino" },
    { code: "mn", name: "Mongolian", nativeName: "Монгол" },
    { code: "ne", name: "Nepali", nativeName: "नेपाली" },
    { code: "si", name: "Sinhala", nativeName: "සිංහල" },
    { code: "my", name: "Myanmar", nativeName: "မြန်မာ" },
    { code: "km", name: "Khmer", nativeName: "ខ្មែរ" },
    { code: "lo", name: "Lao", nativeName: "ລາວ" },
    { code: "kk", name: "Kazakh", nativeName: "Қазақ" },
    { code: "ky", name: "Kyrgyz", nativeName: "Кыргыз" },
    { code: "tg", name: "Tajik", nativeName: "Тоҷикӣ" },
    { code: "tk", name: "Turkmen", nativeName: "Türkmen" },
    { code: "uz", name: "Uzbek", nativeName: "O'zbek" },
  ];

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
              <div className="p-3 bg-blue-100 rounded-full">
                <Globe className="h-8 w-8 text-blue-600" />
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
                  className={`p-4 rounded-lg border-2 text-left transition-all hover:border-blue-300 hover:bg-blue-50 ${
                    selectedLanguage === language.code
                      ? "border-blue-500 bg-blue-50"
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
                      <Check className="h-5 w-5 text-blue-600" />
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
              className="px-8 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Continue"}
            </Button>
          </div>
        </Card>

        {/* Progress indicator */}
        <div className="flex justify-center mt-6">
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};