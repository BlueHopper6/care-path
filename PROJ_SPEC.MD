# CarePath — AI-Powered Healthcare Navigation Tool

## Overview
CarePath is an AI-powered healthcare assistant designed to help patients understand complex medical instructions. It transforms medical jargon into clear, actionable steps without replacing medical professionals.

---

## Problem
Patients frequently leave healthcare visits confused due to:
- Complex medical terminology
- Poorly explained discharge instructions
- Lack of follow-up clarity

This leads to:
- Medication errors
- Missed follow-ups
- Avoidable complications

---

## Solution
CarePath converts medical text into:

- Plain-language summaries
- Step-by-step action plans
- Questions to ask healthcare providers
- Warning signs that require attention

It acts as a **translator and guide**, not a decision-maker.

---

## Target Users
- Patients from underserved communities
- First-time diagnosis patients
- Elderly individuals
- Non-native English speakers
- Low health literacy populations

---

## Core Features

### 1. Text Analysis
Users input medical text and receive:
- Summary
- Action plan
- Questions
- Warning signs

### 2. Simple Mode
- Simplifies output to a 6th-grade level

### 3. Multilingual Support
- Translate outputs into different languages

### 4. History Tracking
- Store and retrieve past analyses

### 5. Safety System
- Detect emergency symptoms
- Prompt immediate medical attention

---

## AI Usage
- LLM (Gemini or Groq) for:
  - Summarization
  - Information extraction
  - Language simplification
- Optional embeddings for contextual understanding

---

## Tech Stack

### Frontend
- Next.js
- Tailwind CSS
- shadcn/ui

### Backend
- Node.js
- Express.js

### Database & Auth
- Supabase

### AI APIs
- Google Gemini (free tier) or Groq

---

## API Design

### POST /api/analyze
Input:
- raw_text
- mode (optional)
- language (optional)

Output:
- summary
- action_plan
- questions_for_doctor
- warning_signs
- confidence_level

---

## Ethical Considerations

### 1. No Diagnosis
The system must NOT:
- Diagnose conditions
- Recommend treatments
- Suggest medication changes

### 2. Transparency
Always include:
“This is not medical advice.”

### 3. Safety
- Detect critical symptoms
- Recommend seeking professional care

### 4. Privacy
- Minimize stored data
- Use secure storage

---

## Key Differentiator
Unlike typical AI health apps, CarePath:
- Does NOT act as a doctor
- Focuses on clarity and navigation
- Empowers patients instead of replacing professionals

---

## MVP Scope
- Text input only (file upload optional)
- Basic AI processing
- Simple UI dashboard
- Core API endpoints
- Safety detection

---

## Future Improvements
- OCR for scanned documents
- Voice input
- Integration with EHR systems
- Personalized health tracking
- Doctor-facing tools

---

## Success Criteria
- Users understand medical instructions better
- Reduced confusion and errors
- Clear demonstration of AI assisting—not replacing—humans