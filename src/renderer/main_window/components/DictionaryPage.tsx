import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Plus, Edit2, Trash2, Save, X, BookOpen } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { DictionaryEntry } from "../../../shared/types/database";

interface EditingEntry {
  id?: string;
  key: string;
  value: string;
}

export const DictionaryPage: React.FC = () => {
  const { state } = useAppContext();
  void state; // Acknowledged unused state from context
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Load dictionary entries on component mount
  useEffect(() => {
    loadDictionaryEntries();
  }, []);

  const loadDictionaryEntries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await window.electronAPI.dictionary.getDictionaryEntries();
      
      if (response.success && response.data) {
        setEntries(response.data.data || []);
      } else {
        setError(response.error || "Failed to load dictionary entries");
      }
    } catch (error) {
      console.error("Error loading dictionary entries:", error);
      setError("Failed to load dictionary entries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!editingEntry?.key.trim() || !editingEntry?.value.trim()) {
      setError("Both key and value are required");
      return;
    }

    try {
      setError(null);
      const response = await window.electronAPI.dictionary.addDictionaryEntry(
        editingEntry.key.trim(),
        editingEntry.value.trim()
      );

      if (response.success) {
        await loadDictionaryEntries(); // Refresh the list
        setEditingEntry(null);
        setIsAddingNew(false);
      } else {
        setError(response.error || "Failed to add dictionary entry");
      }
    } catch (error) {
      console.error("Error adding dictionary entry:", error);
      setError("Failed to add dictionary entry");
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry?.id || !editingEntry?.key.trim() || !editingEntry?.value.trim()) {
      setError("Both key and value are required");
      return;
    }

    try {
      setError(null);
      const response = await window.electronAPI.dictionary.updateDictionaryEntry(
        editingEntry.id,
        editingEntry.key.trim(),
        editingEntry.value.trim()
      );

      if (response.success) {
        await loadDictionaryEntries(); // Refresh the list
        setEditingEntry(null);
      } else {
        setError(response.error || "Failed to update dictionary entry");
      }
    } catch (error) {
      console.error("Error updating dictionary entry:", error);
      setError("Failed to update dictionary entry");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dictionary entry?")) {
      return;
    }

    try {
      setError(null);
      const response = await window.electronAPI.dictionary.deleteDictionaryEntry(id);

      if (response.success) {
        await loadDictionaryEntries(); // Refresh the list
      } else {
        setError(response.error || "Failed to delete dictionary entry");
      }
    } catch (error) {
      console.error("Error deleting dictionary entry:", error);
      setError("Failed to delete dictionary entry");
    }
  };

  const startEditing = (entry: DictionaryEntry) => {
    setEditingEntry({
      id: entry.id,
      key: entry.key,
      value: entry.value,
    });
    setIsAddingNew(false);
  };

  const startAddingNew = () => {
    setEditingEntry({
      key: "",
      value: "",
    });
    setIsAddingNew(true);
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setIsAddingNew(false);
    setError(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Dictionary
            </h1>
            <p className="text-sm text-gray-600">
              Create shortcuts that replace words when you dictate
            </p>
          </div>
        </div>
        <Button onClick={startAddingNew} disabled={isAddingNew || !!editingEntry}>
          <Plus className="h-4 w-4" />
          Add Entry
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setError(null)}
              className="mt-2 text-red-600 hover:text-red-700"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {(isAddingNew || (editingEntry && !editingEntry.id)) && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Dictionary Entry
            </CardTitle>
            <CardDescription>
              When you say the key word, it will be replaced with the value
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key (what you say)
                </label>
                <Input
                  placeholder="e.g., Calendar"
                  value={editingEntry?.key || ""}
                  onChange={(e) => 
                    setEditingEntry(prev => prev ? { ...prev, key: e.target.value } : null)
                  }
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value (replacement text)
                </label>
                <Input
                  placeholder="e.g., https://calendar.google.com"
                  value={editingEntry?.value || ""}
                  onChange={(e) => 
                    setEditingEntry(prev => prev ? { ...prev, value: e.target.value } : null)
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button onClick={handleAddEntry} size="sm">
                <Save className="h-4 w-4" />
                Save Entry
              </Button>
              <Button variant="outline" onClick={cancelEditing} size="sm">
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-600">Loading dictionary entries...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No dictionary entries yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first entry to start using text shortcuts while dictating.
              </p>
              <Button onClick={startAddingNew}>
                <Plus className="h-4 w-4" />
                Add Your First Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                {editingEntry?.id === entry.id ? (
                  // Edit mode
                  <div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Key
                        </label>
                        <Input
                          value={editingEntry.key}
                          onChange={(e) => 
                            setEditingEntry(prev => prev ? { ...prev, key: e.target.value } : null)
                          }
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Value
                        </label>
                        <Input
                          value={editingEntry.value}
                          onChange={(e) => 
                            setEditingEntry(prev => prev ? { ...prev, value: e.target.value } : null)
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={handleUpdateEntry} size="sm">
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={cancelEditing} size="sm">
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <Badge variant="outline" className="font-mono">
                          {entry.key}
                        </Badge>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-900">{entry.value}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Created {formatDate(entry.created_at)}
                        {entry.updated_at !== entry.created_at && (
                          <span> • Updated {formatDate(entry.updated_at)}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => startEditing(entry)}
                        disabled={!!editingEntry || isAddingNew}
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={!!editingEntry || isAddingNew}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 mb-1">
                  How it works
                </h3>
                <p className="text-sm text-blue-800">
                  When you dictate, saying the key word will automatically be replaced with the value. 
                  For example, saying "Calendar" will be replaced with your calendar link.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
