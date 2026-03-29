"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface WarningCardProps {
  warnings: string[];
}

export function WarningCard({ warnings }: WarningCardProps) {
  const items = warnings ?? [];
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <CardTitle className="text-lg text-destructive">Warning Signs</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((warning, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              <span className="leading-relaxed text-destructive/90">{warning}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
