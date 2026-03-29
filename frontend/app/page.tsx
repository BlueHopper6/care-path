import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, ListChecks, Shield, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/carepath/navbar";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero Section */}
      <main className="flex flex-1 flex-col">
        <section className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center md:py-24">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">
              <Shield className="h-4 w-4" />
              Trusted by thousands of patients
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Understand Your Medical Instructions Clearly
            </h1>

            <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Turn complex healthcare documents into simple, actionable steps. 
              Get clear explanations of your discharge notes, lab results, and medical instructions.
            </p>

            <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row sm:justify-center">
              <Link href="/analyze">
                <Button size="lg" className="gap-2">
                  Start Analysis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/history">
                <Button variant="outline" size="lg">
                  View History
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t bg-muted/30 px-4 py-16 md:py-24">
          <div className="container mx-auto max-w-5xl">
            <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight md:text-3xl">
              How CarePath Helps You
            </h2>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Clear Summaries</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Get concise summaries of complex medical documents in plain language
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <ListChecks className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Action Plans</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Numbered steps for medications, follow-ups, and lifestyle changes
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Warning Signs</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Know when to seek immediate medical attention with highlighted alerts
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>This tool does not provide medical advice. Always consult a healthcare professional.</p>
        </div>
      </footer>
    </div>
  );
}
