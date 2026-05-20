"use client";

import { useState } from "react";
import { Navbar } from "@/components/carepath/navbar";
import { InputForm } from "@/components/carepath/input-form";
import { OutputCards } from "@/components/carepath/output-cards";
import { OutputCardsLoader } from "@/components/carepath/loader";
import { Disclaimer } from "@/components/carepath/disclaimer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { analyzeText, saveToHistory, saveRemoteAnalysis, getPreferences, updatePreferences, type AnalyzeResponse, type AnalyzeRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ExportButton } from "@/components/carepath/export-button";
import { SaveConsentDialog } from "@/components/carepath/save-consent-dialog";

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  // Consent Dialog state
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    request: AnalyzeRequest;
    response: AnalyzeResponse;
  } | null>(null);

  const handleSubmit = async (data: AnalyzeRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Get the analysis from the API (does not save to DB anymore)
      const accessToken = session?.access_token;
      const response = await analyzeText(data, accessToken);
      setResult(response);

      // 2. Removed local storage save as per security requirements

      // 3. Handle authenticated user DB saving logic
      if (accessToken) {
        const prefs = await getPreferences(accessToken);
        if (prefs.auto_save_history) {
          // Auto-save silently
          await saveRemoteAnalysis(data, response, accessToken).catch(() => {});
        } else {
          // Prompt user for consent
          setPendingSave({ request: data, response });
          setConsentOpen(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsentSave = async (alwaysSave: boolean) => {
    if (!pendingSave || !session?.access_token) return;
    setConsentSaving(true);
    try {
      // Save this one to history
      await saveRemoteAnalysis(pendingSave.request, pendingSave.response, session.access_token);
      
      // If user checked "Always save automatically", update preferences
      if (alwaysSave) {
        await updatePreferences(true, session.access_token);
      }
    } catch (err) {
      // Silently fail consent save in UI (or add a toast here in the future)
    } finally {
      setConsentSaving(false);
      setConsentOpen(false);
      setPendingSave(null);
    }
  };

  const handleConsentDontSave = () => {
    setConsentOpen(false);
    setPendingSave(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="container mx-auto max-w-3xl space-y-8">
          {/* Page Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Analyze Medical Instructions
            </h1>
            <p className="text-muted-foreground">
              Paste your medical documents below for a clear, easy-to-understand breakdown.
            </p>
          </div>

          {/* Disclaimer Banner */}
          <Disclaimer />

          {/* Input Section */}
          <InputForm onSubmit={handleSubmit} isLoading={isLoading} />

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Analysis Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Analyzing your document...</h2>
              <OutputCardsLoader />
            </div>
          )}

          {/* Output Section */}
          {result && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Analysis Results</h2>
                <ExportButton result={result} />
              </div>
              <OutputCards result={result} />
            </div>
          )}
        </div>
      </main>

      <SaveConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        onSave={handleConsentSave}
        onDontSave={handleConsentDontSave}
        isLoading={consentSaving}
      />
    </div>
  );
}
