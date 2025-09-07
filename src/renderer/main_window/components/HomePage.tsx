import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Pagination } from "./ui/pagination";
import { Flame, FileText, Star, Mic } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

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
  const { state, setTranscripts } = useAppContext();
  const { user, userStats, transcripts, totalTranscripts, isLoading } = state;
  const userName = user?.name || user?.email?.split("@")[0] || "User";

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isPaginationLoading, setIsPaginationLoading] = useState(false);
  const itemsPerPage = 20; // Fixed at 20 items per page

  console.log("HomePage render - state:", {
    transcriptsCount: transcripts.length,
    totalTranscripts,
    currentPage,
    isLoading,
  });

  // Load transcripts when pagination changes (but not on initial load)
  useEffect(() => {
    const loadTranscripts = async () => {
      if (!user) return;

      // Skip loading on initial render (page 1) - let AppContext handle it
      if (currentPage === 1 && isInitialLoad) {
        setIsInitialLoad(false);
        return;
      }

      try {
        setIsPaginationLoading(true);
        const offset = (currentPage - 1) * itemsPerPage;
        const response = await window.electronAPI.db.getTranscripts(
          itemsPerPage,
          offset
        );

        if (response.success && response.data) {
          console.log("Response data:", response.data);
          const { transcripts, totalCount } = response.data.data;
          setTranscripts(transcripts, totalCount);
        }
      } catch (error) {
        console.error("Error loading transcripts:", error);
      } finally {
        setIsPaginationLoading(false);
      }
    };

    loadTranscripts();
  }, [currentPage, user]);

  // Handle pagination changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatDate = (date: Date | string) => {
    // Ensure we have a proper Date object
    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn("Invalid date provided to formatDate:", date);
      return "UNKNOWN DATE";
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateObj.toDateString() === today.toDateString()) {
      return "TODAY";
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      return "YESTERDAY";
    } else {
      return dateObj
        .toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase();
    }
  };

  const formatTime = (date: Date | string) => {
    // Ensure we have a proper Date object
    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn("Invalid date provided to formatTime:", date);
      return "Invalid Time";
    }

    return dateObj.toLocaleTimeString("en-US", {
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
        <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
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
              <Card className="rounded-xl">
                <CardContent className="p-0 ">
                  {transcriptList.map((transcript, index) => (
                    <div
                      key={transcript.id}
                      className={`p-4 ${index !== transcriptList.length - 1 ? "border-b" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-900">
                          {formatTime(transcript.timestamp)}
                        </div>
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

                      <div className=" mb-2 leading-relaxed">
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
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))
        )}

        {totalTranscripts > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalTranscripts}
            onPageChange={handlePageChange}
            isLoading={isPaginationLoading}
          />
        )}
      </div>
    </div>
  );
};
