"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/carepath/navbar";
import { OutputCards } from "@/components/carepath/output-cards";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { History, ChevronDown, ChevronUp, Trash2, FileText } from "lucide-react";
import { getHistory, clearHistory, type AnalysisHistoryItem } from "@/lib/api";
import Link from "next/link";

export default function HistoryPage() {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setHistory(getHistory());
  }, []);

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
    setExpandedId(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  if (!isClient) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex-1 px-4 py-8">
          <div className="container mx-auto max-w-3xl">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 rounded bg-muted" />
              <div className="h-4 w-64 rounded bg-muted" />
            </div>
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
                View and revisit your previous medical document analyses.
              </p>
            </div>

            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                className="gap-2 self-start text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Clear History
              </Button>
            )}
          </div>

          {/* History List */}
          {history.length === 0 ? (
            <Empty
              icon={<History className="h-12 w-12" />}
              title="No analysis history"
              description="Your previous analyses will appear here. Start by analyzing a medical document."
            >
              <Link href="/dashboard">
                <Button className="gap-2">
                  <FileText className="h-4 w-4" />
                  Start Analysis
                </Button>
              </Link>
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
                              {truncateText(item.raw_text)}
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
