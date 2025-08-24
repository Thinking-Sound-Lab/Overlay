import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Flame,
  FileText,
  Star,
  Mic,
  Languages,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

interface UserStats {
  totalWordCount: number;
  averageWPM: number;
  totalRecordings: number;
  streakDays: number;
}

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  wordCount: number;
  wpm: number;
  originalText?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  wasTranslated?: boolean;
  confidence?: number;
  wordCountRatio?: number;
  detectedLanguage?: string;
}

export const HomePage: React.FC = () => {
  const { state } = useAppContext();
  const { user, userProfile, userStats, transcripts } = state;
  const userName = userProfile?.name || user?.email?.split('@')[0] || 'User';
  const getLanguageName = (code: string): string => {
    const languages: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ru: "Russian",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      hi: "Hindi",
      ur: "Urdu",
      ta: "Tamil",
      te: "Telugu",
      bn: "Bengali",
      gu: "Gujarati",
      kn: "Kannada",
      ml: "Malayalam",
      pa: "Punjabi",
      ar: "Arabic",
      he: "Hebrew",
      th: "Thai",
      vi: "Vietnamese",
    };
    return languages[code] || code.toUpperCase();
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "TODAY";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "YESTERDAY";
    } else {
      return date
        .toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const groupTranscriptsByDate = () => {
    const groups: { [key: string]: TranscriptEntry[] } = {};

    transcripts.forEach((transcript) => {
      const dateKey = formatDate(transcript.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transcript);
    });

    return groups;
  };

  const transcriptGroups = groupTranscriptsByDate();

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back, {userName}
        </h1>
        <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-600" />
            <span className="font-semibold text-gray-700">
              {userStats.streakDays} days
            </span>
          </div>
          <div className="text-gray-300">|</div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-gray-700">
              {userStats.totalWordCount.toLocaleString()} words
            </span>
          </div>
          <div className="text-gray-300">|</div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-600" />
            <span className="font-semibold text-gray-700">
              {userStats.averageWPM.toFixed(1)} WPM
            </span>
          </div>
        </div>
      </div>

      <Card className="bg-gray-100 border-0 text-gray-900 mb-8 rounded-xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Mic className="h-6 w-6" />
            <CardTitle className="text-xl text-gray-900">
              Voice dictation in any app
            </CardTitle>
          </div>
          <CardDescription className="text-gray-900/90">
            Hold down the trigger key and speak into any textbox
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-sm text-gray-900/75">
            <span>Total recordings: {userStats.totalRecordings}</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Recent transcripts
        </h3>

        {Object.keys(transcriptGroups).length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="pt-6">
              <p className="text-gray-900">
                No transcripts yet. Start dictating to see your activity here!
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(transcriptGroups).map(([dateKey, transcriptList]) => (
            <div key={dateKey} className="mb-8">
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4 pl-4">
                {dateKey}
              </h4>
              <Card>
                <CardContent className="p-0">
                  {transcriptList.map((transcript, index) => (
                    <div
                      key={transcript.id}
                      className={`p-4 ${index !== transcriptList.length - 1 ? "border-b" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-900">
                          {formatTime(transcript.timestamp)}
                        </div>
                        {transcript.wasTranslated && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md">
                              <Languages className="h-3 w-3" />
                              <span className="text-xs font-medium">
                                {getLanguageName(transcript.sourceLanguage || "")}
                              </span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="text-xs font-medium">
                                {getLanguageName(transcript.targetLanguage || "")}
                              </span>
                            </div>
                            {transcript.confidence !== undefined && (
                              <div className="flex items-center gap-1">
                                {transcript.confidence >= 0.8 ? (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                ) : transcript.confidence >= 0.6 ? (
                                  <AlertTriangle className="h-3 w-3 text-yellow-600" />
                                ) : (
                                  <Info className="h-3 w-3 text-red-600" />
                                )}
                                <span className="text-xs text-gray-500">
                                  {Math.round((transcript.confidence || 0) * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {transcript.wasTranslated && transcript.originalText && (
                        <div className="mb-2 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
                          <div className="text-xs text-gray-500 mb-1">
                            Original:
                          </div>
                          <div className="text-sm text-gray-600 italic">
                            {transcript.originalText}
                          </div>
                        </div>
                      )}

                      <div className="font-medium mb-2 leading-relaxed">
                        {transcript.text}
                        {transcript.wasTranslated && (
                          <Badge
                            variant="secondary"
                            className="ml-2 text-xs bg-green-100 text-green-700"
                          >
                            Translated
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-4 text-xs text-gray-900">
                        <Badge variant="outline" className="text-xs">
                          {transcript.wordCount} words
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {transcript.wpm.toFixed(1)} WPM
                        </Badge>
                        {transcript.wasTranslated && transcript.wordCountRatio !== undefined && (
                          <Badge variant="outline" className={`text-xs ${
                            Math.abs(transcript.wordCountRatio - 1) <= 0.2 
                              ? "text-green-700 border-green-300" 
                              : Math.abs(transcript.wordCountRatio - 1) <= 0.5
                              ? "text-yellow-700 border-yellow-300"
                              : "text-red-700 border-red-300"
                          }`}>
                            Ratio: {transcript.wordCountRatio.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
