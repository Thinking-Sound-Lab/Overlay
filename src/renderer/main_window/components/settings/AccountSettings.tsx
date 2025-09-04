import React from "react";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import { AccountSettingsProps } from "./types";

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  onOpenChange,
  setError,
}) => {
  const handleSignOut = async () => {
    try {
      await window.electronAPI.auth.signOut();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to sign out:", error);
      setError("Failed to sign out");
    }
  };

  const handleDeleteAccount = async () => {
    if (
      confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      try {
        await window.electronAPI.deleteAccount();
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to delete account:", error);
        setError("Failed to delete account");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Account</h2>
      </div>

      {/* User Information */}
      <div className="space-y-4">
        {/* Name */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-900">Name</h3>
            <p className="text-gray-600 text-sm">Your display name</p>
          </div>
          <div className="text-gray-900 font-medium">
            {user?.name || "Not set"}
          </div>
        </div>

        {/* Email */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-900">Email</h3>
            <p className="text-gray-600 text-sm">Your account email</p>
          </div>
          <div className="text-gray-900 font-medium">
            {user?.email || "Not available"}
          </div>
        </div>

        {/* Member Since */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-900">Member Since</h3>
            <p className="text-gray-600 text-sm">Account creation date</p>
          </div>
          <div className="text-gray-900 font-medium">
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString()
              : "Not available"}
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div className="space-y-3 pt-4">
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full text-gray-700 border-gray-300 hover:bg-gray-50"
        >
          Sign Out
        </Button>
        <Button
          onClick={handleDeleteAccount}
          variant="outline"
          className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </div>
    </div>
  );
};