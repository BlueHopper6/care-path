import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarPlus, CalendarDays } from "lucide-react";

interface RecurringTask {
  title: string;
  description: string;
  frequency: string;
  rrule?: string;
}

interface RecurringTasksCardProps {
  tasks: RecurringTask[];
}

export function RecurringTasksCard({ tasks }: RecurringTasksCardProps) {
  if (!tasks || tasks.length === 0) return null;

  const handleAddToCalendar = (task: RecurringTask) => {
    const text = encodeURIComponent(task.title);
    const details = encodeURIComponent(task.description + `\n\nFrequency: ${task.frequency}`);
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}`;
    
    if (task.rrule) {
      // Ensure it starts with RRULE: for the Google Calendar API
      let rruleStr = task.rrule;
      if (!rruleStr.startsWith("RRULE:")) {
        rruleStr = "RRULE:" + rruleStr;
      }
      url += `&recur=${encodeURIComponent(rruleStr)}`;
    }

    window.open(url, "_blank");
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-primary">
          <CalendarDays className="h-5 w-5" />
          Recurring Tasks & Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {tasks.map((task, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground/90">{task.title}</h4>
                <Badge variant="secondary" className="text-xs font-normal">
                  {task.frequency}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 xsm:self-start sm:self-center"
              onClick={() => handleAddToCalendar(task)}
            >
              <CalendarPlus className="h-4 w-4" />
              Add to Google Calendar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
