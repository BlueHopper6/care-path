"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

interface QuestionsCardProps {
  questions: string[];
}

export function QuestionsCard({ questions }: QuestionsCardProps) {
  const items = questions ?? [];
  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <HelpCircle className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-lg">Questions for Your Doctor</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((question, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="leading-relaxed text-muted-foreground">{question}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
