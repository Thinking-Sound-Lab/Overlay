import React from "react";
import { SettingsComponentProps } from "./types";

export const BillingSettings: React.FC<SettingsComponentProps> = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Plans and Billing</h2>
      </div>
      <div className="text-center py-12">
        <p className="text-gray-500">Billing settings coming soon...</p>
      </div>
    </div>
  );
};