"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/carepath/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";
import { getPreferences, updatePreferences } from "@/lib/api";
import { ShieldCheck, Loader2, FileText } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { session, loading: authLoading } = useAuth();
  const [autoSave, setAutoSave] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (session?.access_token) {
      getPreferences(session.access_token)
        .then((prefs) => setAutoSave(prefs.auto_save_history))
        .catch(() => {})
        .finally(() => setIsFetching(false));
    } else {
      setIsFetching(false);
    }
  }, [session, authLoading]);

  const handleToggle = async (checked: boolean) => {
    if (!session?.access_token) return;
    
    // Optistic UI update
    setAutoSave(checked);
    setIsUpdating(true);

    try {
      await updatePreferences(checked, session.access_token);
    } catch (err) {
      // Silently fail update in UI (or add a toast here in the future)
      // Revert if failed
      setAutoSave(!checked);
    } finally {
      setIsUpdating(false);
    }
  };

  if (authLoading || isFetching) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex-1 px-4 py-8">
          <div className="container mx-auto max-w-2xl flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  // Not logged in -> no DB settings to change
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex-1 px-4 py-8">
          <div className="container mx-auto max-w-2xl">
            <div className="space-y-2 mb-8">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">Please sign in to view and manage your account settings.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg">Legal & Policies</CardTitle>
                  <CardDescription>View our terms of service and privacy policy.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Link href="/terms" className="text-primary underline hover:text-primary/80 transition-colors">
                  Terms of Service & Legal Disclaimer
                </Link>
                <Link href="/privacy" className="text-primary underline hover:text-primary/80 transition-colors">
                  Privacy Policy
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="container mx-auto max-w-2xl space-y-8">
          {/* Page Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
            <p className="text-muted-foreground">Manage your account preferences and privacy settings.</p>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">Privacy & Data</CardTitle>
                <CardDescription>Control how your medical analyses are stored.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-4">
                <div className="space-y-1">
                  <Label htmlFor="auto-save" className="text-base">Automatically save to history</Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, your analysis summaries will be automatically saved to your private database history.
                    When disabled, we will ask you each time.
                  </p>
                </div>
                <Switch
                  id="auto-save"
                  checked={autoSave}
                  onCheckedChange={handleToggle}
                  disabled={isUpdating}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">Legal & Policies</CardTitle>
                <CardDescription>View our terms of service and privacy policy.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link href="/terms" className="text-primary underline hover:text-primary/80 transition-colors">
                Terms of Service & Legal Disclaimer
              </Link>
              <Link href="/privacy" className="text-primary underline hover:text-primary/80 transition-colors">
                Privacy Policy
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
