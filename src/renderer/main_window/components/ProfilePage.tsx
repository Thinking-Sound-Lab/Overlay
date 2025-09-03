import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { User, LogOut, Trash2, AlertTriangle, Calendar, Trophy, Target, TrendingUp } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

export const ProfilePage: React.FC = () => {
  const { state, resetAppState, signOut } = useAppContext();
  const { user, userStats, isLoading } = state;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState('');
  
  // Only show loading if we're actually loading and don't have user data yet
  const showLoading = isLoading && !user;

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type "DELETE" to confirm account deletion');
      return;
    }

    setIsDeleting(true);
    setError('');
    
    try {
      // Call the proper delete account API
      const result = await window.electronAPI.deleteAccount();
      
      if (result.error) {
        setError(`Failed to delete account: ${result.error.message}`);
        return;
      }
      
      // Clear all local data completely
      localStorage.clear();
      sessionStorage.clear();
      
      // Reset app state completely
      resetAppState();
      
      // Show success message if available
      if (result.data?.message) {
        console.log('Account deletion result:', result.data.message);
      }
      
      // Reload the app to ensure clean state
      window.location.reload();
    } catch (err) {
      console.error('Delete account error:', err);
      setError('An unexpected error occurred during account deletion');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Only show loading spinner if we don't have user data and are actually loading
  if (showLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // If we don't have user data and aren't loading, something went wrong
  if (!user && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Unable to load profile. Please try refreshing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <User className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your account details and subscription status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.name && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Name</span>
                <span className="text-sm text-gray-900">{user.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <span className="text-sm text-gray-900">{user?.email || 'Loading...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Member since</span>
              <span className="text-sm text-gray-900">
                {user?.created_at ? formatDate(user.created_at) : 'Loading...'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Subscription</span>
              <Badge variant="secondary">{user?.subscription_tier === 'pro' ? 'Pro' : 'Free Tier'}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-600" />
              Your Statistics
            </CardTitle>
            <CardDescription>
              Track your progress and achievements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-600">{userStats.totalWordCount.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Words</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600">{Math.round(userStats.averageWPM)}</div>
                <div className="text-sm text-gray-600">Avg WPM</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div className="text-2xl font-bold text-yellow-600">{userStats.totalRecordings}</div>
                <div className="text-sm text-gray-600">Recordings</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-purple-600">{userStats.streakDays}</div>
                <div className="text-sm text-gray-600">Streak Days</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Account Actions</CardTitle>
            <CardDescription>
              Manage your account settings and data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Sign Out</h3>
                <p className="text-sm text-gray-600">Sign out of your account on this device</p>
              </div>
              <Button 
                onClick={handleSignOut}
                disabled={isSigningOut}
                variant="outline"
                className="flex items-center gap-2"
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

            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">Delete Account</h3>
                  <p className="text-sm text-red-600 mt-1">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <Button 
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2 ml-4"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </div>

              {showDeleteConfirm && (
                <div className="mt-4 pt-4 border-t border-red-200">
                  <div className="space-y-3">
                    <p className="text-sm text-red-700 font-medium">
                      Are you sure? This will permanently delete your account and all data.
                    </p>
                    <p className="text-sm text-red-600">
                      Type "DELETE" below to confirm:
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Type DELETE to confirm"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteAccount}
                        disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                        variant="destructive"
                        size="sm"
                      >
                        {isDeleting ? (
                          <>
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                            Deleting...
                          </>
                        ) : (
                          'Confirm Delete'
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                          setError('');
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};