"use client";

import { useState } from "react";
import { Navbar } from "@/components/carepath/navbar";
import { InputForm } from "@/components/carepath/input-form";
import { OutputCards } from "@/components/carepath/output-cards";
import { OutputCardsLoader } from "@/components/carepath/loader";
import { Disclaimer } from "@/components/carepath/disclaimer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { analyzeText, saveToHistory, type AnalyzeResponse, type AnalyzeRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const handleSubmit = async (data: AnalyzeRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Pass the access token so the backend saves to DB for logged-in users
      const accessToken = session?.access_token;
      const response = await analyzeText(data, accessToken);
      setResult(response);

      // Always save to localStorage for quick local access too
      saveToHistory(data, response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
              <h2 className="text-lg font-semibold">Analysis Results</h2>
              <OutputCards result={result} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
