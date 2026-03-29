"use client";

import { useRef, useState } from "react";
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
import { Upload, Sparkles, X, FileText, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    onSubmit({
      raw_text: rawText,
      mode: simpleMode ? "simple" : "detailed",
      language,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setUploadedFile(file);
    setFileLoading(true);

    try {
      let extractedText = "";

      if (file.type === "text/plain") {
        // TXT files: read in the browser — no backend round-trip needed
        extractedText = await file.text();
      } else if (file.type === "application/pdf") {
        // PDF files: send to backend for text extraction
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/parse-file", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to parse PDF");
        }

        const json = await response.json();
        extractedText = json.data?.text ?? "";
      } else {
        throw new Error("Only PDF and TXT files are supported.");
      }

      if (!extractedText.trim()) {
        throw new Error(
          "Could not extract text from file. It may be empty or image-based."
        );
      }

      // Append to existing text or replace if textarea is empty
      setRawText((prev) =>
        prev.trim()
          ? `${prev.trim()}\n\n--- Uploaded from ${file.name} ---\n${extractedText.trim()}`
          : extractedText.trim()
      );
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to read file");
      setUploadedFile(null);
    } finally {
      setFileLoading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const busy = isLoading || fileLoading;

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
                disabled={busy}
              />
            </Field>
          </FieldGroup>

          {/* File upload row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="hidden"
              onChange={handleFileChange}
              disabled={busy}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              {fileLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {fileLoading ? "Reading file..." : "Upload File"}
            </Button>

            <span className="text-xs text-muted-foreground">PDF or TXT (optional)</span>

            {/* Show uploaded file badge */}
            {uploadedFile && !fileLoading && (
              <Badge variant="secondary" className="gap-1.5 py-1">
                <FileText className="h-3 w-3" />
                {uploadedFile.name}
                <button
                  type="button"
                  onClick={clearFile}
                  className="ml-1 rounded-full hover:text-destructive"
                  aria-label="Remove file"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>

          {/* File error */}
          {fileError && (
            <p className="text-sm text-destructive">{fileError}</p>
          )}

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="simple-mode"
                checked={simpleMode}
                onCheckedChange={setSimpleMode}
                disabled={busy}
              />
              <Label htmlFor="simple-mode" className="cursor-pointer text-sm">
                Explain like I&apos;m 12
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="language" className="text-sm text-muted-foreground">
                Language:
              </Label>
              <Select value={language} onValueChange={setLanguage} disabled={busy}>
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
            disabled={!rawText.trim() || busy}
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
