"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function Disclaimer() {
  return (
    <Alert variant="default" className="border-primary/20 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm text-muted-foreground">
        This tool does not provide medical advice. Always consult a healthcare professional.
      </AlertDescription>
    </Alert>
  );
}
