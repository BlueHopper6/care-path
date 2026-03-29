"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { AnalyzeResponse } from "@/lib/api";

interface ExportButtonProps {
  result: AnalyzeResponse;
  className?: string;
}

/**
 * Opens a styled print window with the full analysis report.
 * The browser's native print dialog lets users save as PDF or print on paper.
 * Zero extra dependencies.
 */
export function ExportButton({ result, className }: ExportButtonProps) {
  const handleExport = () => {
    const now = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const renderList = (items: string[], ordered = false) => {
      const tag = ordered ? "ol" : "ul";
      const listItems = items
        .map((item) => `<li>${escHtml(item)}</li>`)
        .join("\n");
      return `<${tag}>${listItems}</${tag}>`;
    };

    const hasWarnings = result.warning_signs?.length > 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CarePath Analysis Report — ${now}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #111827;
      padding: 32px 40px;
      max-width: 760px;
      margin: auto;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon {
      width: 32px; height: 32px;
      background: #2563eb;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-icon svg { width: 18px; height: 18px; fill: white; }
    .brand-name { font-size: 20px; font-weight: 700; color: #2563eb; }
    .report-meta { text-align: right; color: #6b7280; font-size: 11px; line-height: 1.8; }
    .report-title { font-size: 13px; font-weight: 600; color: #111827; }

    /* ── Section cards ── */
    .section {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      margin-bottom: 18px;
      overflow: hidden;
      break-inside: avoid;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .section-icon {
      width: 28px; height: 28px;
      border-radius: 6px;
      background: #dbeafe;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .section-icon svg { width: 16px; height: 16px; stroke: #2563eb; fill: none; }
    .section-title { font-size: 13px; font-weight: 600; color: #1e40af; }
    .section-body { padding: 14px 16px; }

    /* ── Warning section ── */
    .section.warning { border-color: #fca5a5; }
    .section.warning .section-header { background: #fff1f2; border-color: #fca5a5; }
    .section.warning .section-icon { background: #fee2e2; }
    .section.warning .section-icon svg { stroke: #dc2626; }
    .section.warning .section-title { color: #b91c1c; }
    .section.warning .section-body { color: #7f1d1d; }

    /* ── Lists ── */
    ol, ul { padding-left: 20px; }
    li { padding: 3px 0; color: #374151; }
    li + li { border-top: 1px solid #f3f4f6; padding-top: 6px; margin-top: 3px; }

    /* ── Summary text ── */
    .summary-text { color: #374151; line-height: 1.7; }

    /* ── Confidence badge ── */
    .confidence {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
      text-transform: uppercase;
    }
    .confidence.high { background: #dcfce7; color: #15803d; }
    .confidence.medium { background: #fef9c3; color: #92400e; }
    .confidence.low { background: #fee2e2; color: #b91c1c; }

    /* ── Disclaimer ── */
    .disclaimer {
      margin-top: 24px;
      padding: 12px 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 11px;
      color: #6b7280;
    }

    /* ── Print styles ── */
    @media print {
      body { padding: 20px 24px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
        </svg>
      </div>
      <span class="brand-name">CarePath</span>
    </div>
    <div class="report-meta">
      <div class="report-title">Medical Analysis Report</div>
      <div>Generated: ${now}</div>
      <div>Confidence: <strong>${result.confidence_level ?? "medium"}</strong></div>
    </div>
  </div>

  <!-- Summary -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <span class="section-title">Summary</span>
    </div>
    <div class="section-body">
      <p class="summary-text">${escHtml(result.summary)}</p>
    </div>
  </div>

  <!-- Action Plan -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      </div>
      <span class="section-title">Action Plan</span>
    </div>
    <div class="section-body">
      ${renderList(result.action_plan ?? [], true)}
    </div>
  </div>

  <!-- Questions for Doctor -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <span class="section-title">Questions for Your Doctor</span>
    </div>
    <div class="section-body">
      ${renderList(result.questions_for_doctor ?? [])}
    </div>
  </div>

  ${hasWarnings ? `
  <!-- Warning Signs -->
  <div class="section warning">
    <div class="section-header">
      <div class="section-icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <span class="section-title">Warning Signs — Seek Care Immediately</span>
    </div>
    <div class="section-body">
      ${renderList(result.warning_signs)}
    </div>
  </div>
  ` : ""}

  <!-- Disclaimer -->
  <div class="disclaimer">
    ⚠️ <strong>Medical Disclaimer:</strong> ${escHtml(
      result.disclaimer ??
        "This report is not medical advice. Always consult a qualified healthcare professional before making any medical decisions."
    )}
  </div>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=820,height=900");
    if (!printWindow) {
      alert("Pop-ups are blocked. Please allow pop-ups for this site to export.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    // Small delay lets the browser render styles before printing
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={handleExport}
    >
      <Download className="mr-2 h-4 w-4" />
      Export PDF
    </Button>
  );
}

/** Escape HTML special chars to prevent XSS in the print document */
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
