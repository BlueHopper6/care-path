"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/carepath/navbar";
import { OutputCards } from "@/components/carepath/output-cards";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { History, ChevronDown, ChevronUp, Trash2, FileText, Loader2 } from "lucide-react";
import {
  fetchRemoteHistory,
  type AnalysisHistoryItem,
  type BackendHistoryItem,
  type AnalyzeResponse,
} from "@/lib/api";
import { useAuth } from "@/context/auth";
import Link from "next/link";
import { ExportButton } from "@/components/carepath/export-button";

export default function HistoryPage() {
  const { session, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Load history — remote for logged-in users only
  useEffect(() => {
    setIsClient(true);
    if (authLoading) return;

    if (session?.access_token) {
      // Fetch persisted analyses from the backend
      setIsFetching(true);
      fetchRemoteHistory(session.access_token)
        .then((remoteItems: BackendHistoryItem[]) => {
          // Map backend shape to the AnalysisHistoryItem shape the UI expects
          const mapped: AnalysisHistoryItem[] = remoteItems.map((item) => ({
            id: item.id,
            raw_text: item.documents?.raw_text ?? "",
            mode: (item.mode === "simple" ? "simple" : "detailed") as "simple" | "detailed",
            language: item.language,
            result: {
              summary: item.summary,
              action_plan: item.action_plan ?? [],
              questions_for_doctor: item.questions ?? [],
              warning_signs: item.warnings ?? [],
              confidence_level: item.confidence_level,
            } as AnalyzeResponse,
            created_at: item.created_at,
          }));
          setHistory(mapped);
        })
        .catch(() => {})
        .finally(() => setIsFetching(false));
    } else {
      setIsFetching(false);
    }
  }, [session, authLoading]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const truncateText = (text: string, maxLength = 100) =>
    text.length <= maxLength ? text : text.substring(0, maxLength) + "...";

  if (!isClient || authLoading || isFetching) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex-1 px-4 py-8">
          <div className="container mx-auto max-w-3xl flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  // Not logged in -> access denied
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex-1 px-4 py-8">
          <div className="container mx-auto max-w-3xl space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Analysis History</h1>
              <p className="text-muted-foreground">Sign in to view and save your analyses.</p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">Please sign in to access your private medical analysis history. Guest users do not have access to saved history for privacy and security reasons.</p>
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
        <div className="container mx-auto max-w-3xl space-y-8">
          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Analysis History
              </h1>
              <p className="text-muted-foreground">
                Your saved analyses from your account.
              </p>
            </div>
          </div>

          {/* History List */}
          {history.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>No analysis history</EmptyTitle>
                <EmptyDescription>
                  Your analyses will appear here after you analyze a document.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href="/analyze">
                  <Button className="gap-2">
                    <FileText className="h-4 w-4" />
                    Start Analysis
                  </Button>
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <Collapsible
                  key={item.id}
                  open={expandedId === item.id}
                  onOpenChange={(open) => setExpandedId(open ? item.id : null)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer transition-colors hover:bg-muted/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle className="text-base">
                                {formatDate(item.created_at)}
                              </CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                {item.mode === "simple" ? "Simple" : "Detailed"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {item.language.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {truncateText(item.raw_text || item.result.summary)}
                            </p>
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            {expandedId === item.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="border-t pt-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="font-medium text-foreground">Analysis Details</h3>
                          <ExportButton result={item.result} />
                        </div>
                        <OutputCards result={item.result} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
