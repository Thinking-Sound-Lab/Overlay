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
import { LogIn, UserPlus, Eye, EyeOff } from "lucide-react";

interface AuthPageProps {
  onSignIn: (user: any) => void;
  onSignUp: (signUpData: { user?: any, email: string, needsVerification: boolean }) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSignIn, onSignUp }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // Listen for auth state changes to clear Google loading state
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
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChanged);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
    };
  }, [isGoogleLoading, onSignIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await auth.signIn(email, password);
      } else {
        // For signup, name is required
        if (!name.trim()) {
          setError("Name is required for signup");
          return;
        }
        result = await auth.signUp(email, password, name.trim());
      }

      if (!result.success) {
        setError(result.error || "Authentication failed");
      } else {
        console.log(
          `AuthPage: ${isLogin ? 'Sign in' : 'Sign up'} response:`,
          result
        );
        
        // Call the appropriate handler based on login/signup mode
        if (isLogin) {
          if (result.data?.data?.user) {
            onSignIn(result.data.data.user);
          } else {
            console.error("AuthPage: Sign in successful but no user data");
            setError("Sign in successful but user data not received");
          }
        } else {
          // For sign up, check if session exists (email verified) or needs verification
          const user = result.data?.data?.user;
          const session = result.data?.data?.session;
          
          if (user && session) {
            // User created and verified immediately (rare case)
            console.log("AuthPage: User signed up and verified immediately");
            onSignUp({ user, email, needsVerification: false });
          } else if (user && !session) {
            // User created but needs email verification
            console.log("AuthPage: User signed up, email verification required");
            onSignUp({ user: null, email, needsVerification: true });
          } else {
            console.error("AuthPage: Unexpected sign-up response structure:", result);
            // Default to verification flow with provided email
            onSignUp({ user: null, email, needsVerification: true });
          }
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsGoogleLoading(true);

    try {
      const result = await auth.signInWithGoogle();

      if (!result.success) {
        setError(result.error || "Google authentication failed");
        setIsGoogleLoading(false); // Clear loading on immediate error
      } else {
        // Google OAuth will redirect externally, keep loading until auth completes
        console.log("Google OAuth initiated - waiting for callback...");
        // Don't clear isGoogleLoading here - it will be cleared by auth-state-changed event
      }
    } catch (err) {
      console.error("Google auth error:", err);
      setError("An unexpected error occurred during Google sign in");
      setIsGoogleLoading(false); // Clear loading on exception
    }
    // Note: Don't use finally block to clear loading - let the auth state change event handle it
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 relative h-full">
      {/* Draggable area at top */}
      {/* <div
        className="absolute top-0 left-0 right-0 h-8 z-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      /> */}
      <Card
        className="w-full max-w-md relative z-20"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl font-bold text-gray-900">Overlay</span>
          </div>
          <CardTitle className="text-xl">
            {isLogin ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Sign in to access your transcripts and settings"
              : "Get started with AI-powered voice dictation"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your full name"
                  disabled={isLoading}
                />
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="your@email.com"
                disabled={isLoading}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  {isLogin ? "Signing in..." : "Creating account..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? (
                    <>
                      <LogIn className="h-4 w-4" />
                      Sign in
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create account
                    </>
                  )}
                </span>
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full mb-6"
          >
            {isGoogleLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></span>
                Signing in with Google...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285f4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34a853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#fbbc05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#ea4335"
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
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setEmail("");
                setPassword("");
                setName("");
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={isLoading}
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
