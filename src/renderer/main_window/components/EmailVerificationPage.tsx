import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Mail, CheckCircle, RefreshCw, ArrowRight } from "lucide-react";
import { auth } from "../lib/api_client";

interface EmailVerificationPageProps {
  userEmail: string;
  onVerificationComplete: () => void;
}

export const EmailVerificationPage: React.FC<EmailVerificationPageProps> = ({
  userEmail,
  onVerificationComplete,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Listen for auth state changes to detect when email is verified
  useEffect(() => {
    console.log("EmailVerificationPage: Setting up auth state listener for:", userEmail);
    
    const handleAuthStateChanged = (event: any) => {
      const { user, authenticated, error } = event.detail;
      
      console.log("EmailVerificationPage: Auth state changed:", {
        authenticated,
        userEmail: user?.email,
        currentEmail: userEmail,
        error
      });
      
      // If user is now authenticated with the same email, verification completed
      if (authenticated && user && user.email === userEmail) {
        console.log("EmailVerificationPage: Email verified via auth state change, proceeding to next step");
        // Clean up polling
        if (pollingIntervalId) {
          clearInterval(pollingIntervalId);
          setPollingIntervalId(null);
        }
        onVerificationComplete();
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChanged);
    
    // Set up periodic polling as fallback (every 5 seconds)
    const pollForVerification = setInterval(async () => {
      try {
        console.log("EmailVerificationPage: Polling for email verification...");
        const result = await auth.getCurrentUser(true);
        if (result.success && result.data?.data?.user && result.data.data.user.email === userEmail) {
          console.log("EmailVerificationPage: Email verified via polling, proceeding");
          clearInterval(pollForVerification);
          setPollingIntervalId(null);
          onVerificationComplete();
        }
      } catch (error) {
        console.log("EmailVerificationPage: Polling check failed:", error);
      }
    }, 5000);
    
    setPollingIntervalId(pollForVerification);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
      if (pollForVerification) {
        clearInterval(pollForVerification);
      }
    };
  }, [userEmail, onVerificationComplete, pollingIntervalId]);

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendMessage(null);
    
    try {
      console.log("EmailVerificationPage: Resending verification email to:", userEmail);
      
      // Resend verification email
      const result = await auth.resendEmailVerification(userEmail);
      
      if (result.success) {
        setResendMessage("Verification email sent! Check your inbox.");
      } else {
        setResendMessage(result.error || "Failed to resend verification email");
      }
    } catch (error) {
      console.error("EmailVerificationPage: Error resending verification:", error);
      setResendMessage("Failed to resend verification email");
    } finally {
      setIsResending(false);
      // Clear message after 5 seconds
      setTimeout(() => setResendMessage(null), 5000);
    }
  };

  const handleCheckVerification = async () => {
    setIsChecking(true);
    
    try {
      console.log("EmailVerificationPage: Checking if email is verified (force refresh)");
      
      // Force refresh session to get the latest auth state from Supabase
      const result = await auth.getCurrentUser(true);
      
      if (result.success && result.data?.data?.user) {
        console.log("EmailVerificationPage: User is now verified, proceeding");
        // Clean up polling
        if (pollingIntervalId) {
          clearInterval(pollingIntervalId);
          setPollingIntervalId(null);
        }
        onVerificationComplete();
      } else {
        console.log("EmailVerificationPage: Still not verified, trying session refresh");
        
        // Also try explicit session refresh as fallback
        const refreshResult = await auth.refreshSession();
        if (refreshResult.success && refreshResult.data?.user) {
          console.log("EmailVerificationPage: Session refresh successful, proceeding");
          // Clean up polling
          if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            setPollingIntervalId(null);
          }
          onVerificationComplete();
        } else {
          // Show temporary message that verification is still pending
          setResendMessage("Email not yet verified. Please check your inbox and try again.");
          setTimeout(() => setResendMessage(null), 5000);
        }
      }
    } catch (error) {
      console.error("EmailVerificationPage: Error checking verification:", error);
      setResendMessage("Failed to check verification status");
      setTimeout(() => setResendMessage(null), 3000);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 relative h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to{" "}
            <span className="font-medium text-gray-900">{userEmail}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="text-sm text-gray-600 leading-relaxed">
              <p className="mb-2">
                Click the verification link in your email to activate your account.
              </p>
              <p className="text-xs text-gray-500">
                Don't see the email? Check your spam folder or try resending.
              </p>
            </div>

            {resendMessage && (
              <div className={`text-sm p-3 rounded-lg ${
                resendMessage.includes("sent") || resendMessage.includes("Check") 
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-red-700 bg-red-50 border border-red-200"
              }`}>
                {resendMessage}
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleResendVerification}
                disabled={isResending}
                variant="outline"
                className="w-full"
              >
                {isResending ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Resending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Resend verification email
                  </span>
                )}
              </Button>

              <Button
                onClick={handleCheckVerification}
                disabled={isChecking}
                className="w-full"
              >
                {isChecking ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Checking...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    I've verified my email
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>

            <div className="text-xs text-gray-500 pt-2">
              Having trouble? You can also verify by clicking the link and then refreshing this page.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};