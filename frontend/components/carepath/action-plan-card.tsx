"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks } from "lucide-react";

interface ActionPlanCardProps {
  actionPlan: string[];
}

export function ActionPlanCard({ actionPlan }: ActionPlanCardProps) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ListChecks className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-lg">Action Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {actionPlan.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="leading-relaxed text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
