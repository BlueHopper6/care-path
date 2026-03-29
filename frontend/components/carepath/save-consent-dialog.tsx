// frontend/components/carepath/save-consent-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Database, ShieldCheck } from "lucide-react";

interface SaveConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (alwaysSave: boolean) => void;
  onDontSave: () => void;
  isLoading: boolean;
}

export function SaveConsentDialog({
  open,
  onOpenChange,
  onSave,
  onDontSave,
  isLoading,
}: SaveConsentDialogProps) {
  const [alwaysSave, setAlwaysSave] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Save to History?</DialogTitle>
          </div>
          <DialogDescription className="text-base text-foreground/80 mt-2">
            Would you like to securely save this analysis to your account history? 
            It will not be shared with anyone and you can delete it at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-start space-x-3 bg-muted/50 p-4 rounded-lg border border-border/50">
            <Checkbox
              id="always-save"
              checked={alwaysSave}
              onCheckedChange={(checked) => setAlwaysSave(checked as boolean)}
              disabled={isLoading}
              className="mt-1"
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="always-save"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Always save automatically
              </Label>
              <p className="text-xs text-muted-foreground">
                You can change this later in your Settings.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-0 mt-4">
          <Button
            variant="outline"
            onClick={onDontSave}
            disabled={isLoading}
            className="sm:w-auto"
          >
            Don't save
          </Button>
          <Button
            onClick={() => onSave(alwaysSave)}
            disabled={isLoading}
            className="sm:w-auto gap-2"
          >
            <Database className="h-4 w-4" />
            {isLoading ? "Saving..." : alwaysSave ? "Save & Apply Setting" : "Save just this one"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
