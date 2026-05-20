import { Navbar } from "@/components/carepath/navbar";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex flex-1 flex-col py-12 px-4 md:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-4 border-b pb-8">
            <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-muted-foreground text-lg">Last Updated: {new Date().toLocaleDateString()}</p>
            
            <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-6 mt-6">
              <h2 className="text-xl font-bold mb-2 text-destructive">CRITICAL NOTICE: NOT HIPAA COMPLIANT</h2>
              <p className="font-semibold text-foreground">
                CarePath is an educational computer science project. It is absolutely NOT a HIPAA-compliant medical system. Do not upload Sensitive Personally Identifiable Information (PII) or Protected Health Information (PHI). By using this service, you acknowledge that you are using experimental software at your own risk.
              </p>
            </div>
          </div>

          <div className="space-y-6 text-foreground/90 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">1. Introduction</h2>
              <p>
                This Privacy Policy explains how CarePath ("we", "us", or "our") collects, uses, discloses, and safeguards your information when you use our application. Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access the application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">2. Information We Collect</h2>
              <p>
                We may collect information about you in a variety of ways. The information we may collect via the application includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Text and Documents:</strong> We process the medical text or documents you provide to generate summaries and actionable plans. This data is temporarily processed by our servers and third-party AI providers.</li>
                <li><strong>Usage Data:</strong> We may automatically collect certain information when you visit, use, or navigate the application. This information does not reveal your specific identity but may include device and usage information, such as your IP address, browser and device characteristics, operating system, referring URLs, and information about how and when you use our application.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
              <p>
                Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the application to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Generate the medical text summaries and actionable plans you request.</li>
                <li>Monitor and analyze usage and trends to improve your experience with the application.</li>
                <li>Perform internal diagnostics to ensure system stability and reliability.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">4. Disclosure of Your Information</h2>
              <p>
                We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Third-Party Service Providers:</strong> We share your text inputs with third-party Large Language Model (LLM) providers (e.g., OpenAI, Google, Anthropic) to process and summarize the text. These providers have their own privacy policies governing data usage.</li>
                <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">5. Data Security</h2>
              <p>
                We use administrative, technical, and physical security measures to help protect your personal information. However, please also remember that we cannot guarantee that the internet itself is 100% secure. 
              </p>
              <p className="font-semibold uppercase text-destructive">
                CarePath is an educational project and is not equipped with enterprise-grade healthcare security measures. It is NOT HIPAA compliant. You are strictly advised to redact all personal names, dates of birth, addresses, and other identifiers before using this service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">6. Data Retention</h2>
              <p>
                We only keep your information for as long as it is necessary for the purposes set out in this Privacy Policy, unless a longer retention period is required or permitted by law. Active document inputs are processed ephemerally or stored only temporarily for the duration of the active session to provide the core functionality of the application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">7. Children's Privacy</h2>
              <p>
                We do not knowingly solicit information from or market to children under the age of 13. If you become aware of any data we have collected from children under age 13, please discontinue use immediately.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">8. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time in order to reflect, for example, changes to our practices or for other operational, legal, or regulatory reasons. We will alert you about any changes by updating the "Last Updated" date of this Privacy Policy.
              </p>
            </section>

            <div className="mt-12 rounded-lg bg-muted p-6 border text-center">
              <p className="text-lg font-medium">
                By using CarePath, you acknowledge that you have read and agree to this Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground flex flex-col gap-2">
          <p>This tool does not provide medical advice. Always consult a healthcare professional.</p>
          <p className="space-x-4">
            <Link href="/terms" className="underline hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="underline hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
