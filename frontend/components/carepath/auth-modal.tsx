"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2 } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  defaultMode?: "signin" | "signup";
}

export function AuthModal({
  open,
  onOpenChange,
  onSignIn,
  onSignUp,
  defaultMode = "signin",
}: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Sync mode when modal opens or defaultMode changes
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setSuccess(false);
      setError(null);
      setPassword("");
    }
  }, [open, defaultMode]);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPassword = password.length >= 6;
  const isFormValid = isValidEmail && isValidPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError(null);

    try {
      if (mode === "signin") {
        await onSignIn(email, password);
        onOpenChange(false);
        setEmail("");
        setPassword("");
      } else {
        await onSignUp(email, password);
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Account created!</h3>
              <p className="text-sm text-muted-foreground">
                Please follow the instructions in the email sent to <span className="font-medium text-foreground">{email}</span> to finish signing up.
              </p>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                onOpenChange(false);
                setSuccess(false);
                setEmail("");
                setPassword("");
              }}
            >
              OK
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {mode === "signin" ? "Sign In" : "Create Account"}
              </DialogTitle>
              <DialogDescription>
                {mode === "signin"
                  ? "Welcome back. Enter your credentials to continue."
                  : "Create a new account to save your analysis history."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />
                {email && !isValidEmail && (
                  <p className="text-sm text-destructive">
                    Please enter a valid email address
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                {password && !isValidPassword && (
                  <p className="text-sm text-destructive">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!isFormValid || loading}
              >
                {loading && <Spinner className="mr-2" />}
                {mode === "signin" ? "Sign In" : "Sign Up"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  {"Don't have an account? "}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
