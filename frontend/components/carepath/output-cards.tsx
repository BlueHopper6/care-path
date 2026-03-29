"use client";

import type { AnalyzeResponse } from "@/lib/api";
import { SummaryCard } from "./summary-card";
import { ActionPlanCard } from "./action-plan-card";
import { RecurringTasksCard } from "./recurring-tasks-card";
import { QuestionsCard } from "./questions-card";
import { WarningCard } from "./warning-card";

interface OutputCardsProps {
  result: AnalyzeResponse;
}

export function OutputCards({ result }: OutputCardsProps) {
  return (
    <div className="grid gap-6">
      <SummaryCard summary={result.summary} />
      {result.recurring_tasks && result.recurring_tasks.length > 0 && (
        <RecurringTasksCard tasks={result.recurring_tasks} />
      )}
      <ActionPlanCard actionPlan={result.action_plan} />
      <QuestionsCard questions={result.questions_for_doctor} />
      <WarningCard warnings={result.warning_signs} />
    </div>
  );
}
