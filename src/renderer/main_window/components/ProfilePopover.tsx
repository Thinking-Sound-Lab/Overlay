import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { 
  User, 
  LogOut, 
  Calendar, 
  Trophy, 
  Target, 
  TrendingUp,
  AlertTriangle 
} from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

interface ProfilePopoverProps {
  trigger: React.ReactNode;
}

export const ProfilePopover: React.FC<ProfilePopoverProps> = ({ trigger }) => {
  const { state, signOut } = useAppContext();
  const { user, userStats } = state;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError('');
    
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
      setError('An unexpected error occurred during sign out');
    } finally {
      setIsSigningOut(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!user) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          {trigger}
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="text-center py-4">
            <p className="text-gray-600">Not signed in</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => {
                // Handle sign in - this would typically redirect to auth
                console.log("Sign in clicked");
              }}
            >
              Sign In
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div 
          title="Profile"
          className="inline-block"
        >
          {trigger}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                {user?.name || 'User'}
              </div>
              <div className="text-sm text-gray-600">{user.email}</div>
            </div>
            <Badge 
              variant="secondary"
              className={user?.subscription_tier === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}
            >
              {user?.subscription_tier === 'pro' ? 'Pro' : 'Free'}
            </Badge>
          </div>

          {/* Account Info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">
                Member since {user?.created_at ? formatDate(user.created_at) : 'Unknown'}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          {userStats && (
            <div className="pt-3 border-t">
              <div className="text-sm font-medium text-gray-700 mb-2">Quick Stats</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Target className="h-3 w-3 text-blue-600" />
                  <span className="text-gray-600">{userStats.totalWordCount.toLocaleString()} words</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-gray-600">{Math.round(userStats.averageWPM)} WPM</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-yellow-600" />
                  <span className="text-gray-600">{userStats.totalRecordings} recordings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-purple-600" />
                  <span className="text-gray-600">{userStats.streakDays} day streak</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t">
            <Button
              onClick={handleSignOut}
              disabled={isSigningOut}
              variant="outline"
              size="sm"
              className="w-full flex items-center gap-2"
            >
              {isSigningOut ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></span>
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};