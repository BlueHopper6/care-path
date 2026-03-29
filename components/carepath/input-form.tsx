"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";

interface InputFormProps {
  onSubmit: (data: {
    raw_text: string;
    mode: "simple" | "detailed";
    language: string;
  }) => void;
  isLoading: boolean;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "pt", label: "Portuguese" },
];

export function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [rawText, setRawText] = useState("");
  const [simpleMode, setSimpleMode] = useState(false);
  const [language, setLanguage] = useState("en");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    onSubmit({
      raw_text: rawText,
      mode: simpleMode ? "simple" : "detailed",
      language,
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="medical-text">Medical Instructions</FieldLabel>
              <Textarea
                id="medical-text"
                placeholder="Paste your medical instructions, lab results, or discharge notes here..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[200px] resize-none"
                disabled={isLoading}
              />
            </Field>
          </FieldGroup>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload File
            </Button>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="simple-mode"
                checked={simpleMode}
                onCheckedChange={setSimpleMode}
                disabled={isLoading}
              />
              <Label htmlFor="simple-mode" className="cursor-pointer text-sm">
                Explain like I&apos;m 12
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="language" className="text-sm text-muted-foreground">
                Language:
              </Label>
              <Select value={language} onValueChange={setLanguage} disabled={isLoading}>
                <SelectTrigger id="language" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2"
            disabled={!rawText.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Spinner className="h-4 w-4" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
