import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { auth } from "../lib/api_client";
import { Mail, LogIn, UserPlus } from "lucide-react";

interface AuthPageProps {
  onSignIn: (user: any) => void;
  onSignUp: (signUpData: { user?: any, email: string, needsVerification: boolean }) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSignIn, onSignUp }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingMagicLinkSignup, setPendingMagicLinkSignup] = useState<{email: string, name: string} | null>(null);

  // Listen for auth state changes to handle Google and magic link authentication
  useEffect(() => {
    const handleAuthStateChanged = (event: any) => {
      const { user, authenticated, error: authError } = event.detail;
      
      if (isGoogleLoading) {
        console.log('AuthPage: Auth state changed during Google sign-in:', {
          authenticated,
          user: user?.email,
          error: authError
        });
        
        // Clear Google loading state
        setIsGoogleLoading(false);
        
        if (authError) {
          setError(authError);
        } else if (authenticated && user) {
          // For Google auth, we don't know if it's signin or signup, so default to signin logic
          onSignIn(user);
        }
      } else if (authenticated && user && (successMessage || pendingMagicLinkSignup)) {
        // This is a magic link authentication completing
        console.log('AuthPage: Magic link authentication completed:', user.email);
        setSuccessMessage("");
        
        if (pendingMagicLinkSignup) {
          // This was a sign-up magic link
          console.log('AuthPage: Magic link sign-up completed for:', user.email);
          setPendingMagicLinkSignup(null);
          onSignUp({ user, email: user.email, needsVerification: false });
        } else {
          // This was a sign-in magic link
          console.log('AuthPage: Magic link sign-in completed for:', user.email);
          onSignIn(user);
        }
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChanged);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
    };
  }, [isGoogleLoading, onSignIn, onSignUp, successMessage, pendingMagicLinkSignup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      if (!email.trim()) {
        setError("Email is required");
        return;
      }

      let result;
      if (isLogin) {
        result = await auth.signInWithMagicLink(email.trim());
      } else {
        // For signup, name is required
        if (!name.trim()) {
          setError("Name is required for signup");
          return;
        }
        result = await auth.signUpWithMagicLink(email.trim(), name.trim());
      }

      if (!result.success) {
        setError(result.error || "Failed to send magic link");
      } else {
        console.log(
          `AuthPage: Magic link ${isLogin ? 'sign in' : 'sign up'} sent successfully`
        );
        setSuccessMessage(
          `Magic link sent to ${email}! Check your email and click the link to ${isLogin ? 'sign in' : 'complete signup'}.`
        );
        // Store signup info for post-authentication handling (no immediate redirect)
        if (!isLogin) {
          setPendingMagicLinkSignup({ email: email.trim(), name: name.trim() });
        }
      }
    } catch (error) {
      console.error(`AuthPage: Magic link ${isLogin ? 'sign in' : 'sign up'} error:`, error);
      setError(`Failed to send magic link`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsGoogleLoading(true);
    
    try {
      console.log('AuthPage: Initiating Google sign-in...');
      const result = await auth.signInWithGoogle();
      
      if (!result.success) {
        console.error('AuthPage: Google sign-in failed:', result.error);
        setError(result.error || "Google sign-in failed");
        setIsGoogleLoading(false);
      }
      // Success case is handled by auth state listener
    } catch (error) {
      console.error('AuthPage: Google sign-in error:', error);
      setError("Google sign-in failed");
      setIsGoogleLoading(false);
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
          <CardTitle className="text-xl">
            {isLogin ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? "Enter your email to receive a magic link"
              : "Enter your details to get started"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
                required
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                  required={!isLogin}
                />
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md border border-green-200">
                {successMessage}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Sending magic link...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send magic link
                </span>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full"
          >
            {isGoogleLoading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                Connecting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </span>
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-blue-600 hover:text-blue-500 underline"
            >
              {isLogin ? (
                <span className="flex items-center justify-center gap-1">
                  <UserPlus className="h-4 w-4" />
                  Don't have an account? Sign up
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1">
                  <LogIn className="h-4 w-4" />
                  Already have an account? Sign in
                </span>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};