# CarePath - AI-Powered Healthcare Navigation

## Overview
CarePath is an AI-powered healthcare navigation tool designed to help patients understand complex medical documents. It transforms discharge summaries, lab reports, and treatment instructions into clear, structured, and actionable information without replacing professional medical advice.

Built for a social impact hackathon, CarePath addresses a critical gap in healthcare: patients often leave medical appointments confused, overwhelmed, and unsure of what to do next. This project focuses on empowering individuals with clarity, not making decisions for them.

---

## Problem
Healthcare information is often:
- Filled with technical jargon
- Poorly explained in time-constrained clinical settings
- Difficult for patients with low health literacy or language barriers

As a result, patients may:
- Misunderstand treatment instructions
- Miss medications or follow-ups
- Fail to recognize warning signs

CarePath aims to reduce this confusion by making medical information accessible and actionable.

---

## Solution
CarePath acts as a **translator and guide**, not a decision-maker.

Users can input medical text (ex: discharge notes, lab results), and CarePath generates:

- **Plain-language summaries** of what the document says  
- **Step-by-step action plans** for what to do next  
- **Suggested questions** to ask a healthcare provider  
- **Warning signs** that may require attention  

The system is designed to help users better understand their care while keeping healthcare professionals at the center of decision-making.

---

## Key Features
- **Medical Text Simplification**  
  Converts complex clinical language into clear, patient-friendly explanations

- **Actionable Care Plans**  
  Extracts concrete next steps, including medications, follow-ups, and lifestyle guidance

- **Doctor Question Generator**  
  Helps patients prepare for more effective medical conversations

- **Safety Awareness**  
  Highlights warning signs and encourages seeking professional care when needed

- **“Explain Like I’m 12” Mode**  
  Further simplifies content for maximum accessibility

- **Multilingual Support**  
  Outputs information in different languages for broader accessibility

- **History Tracking**  
  Stores past analyses for easy reference

---

## Tech Stack

### Frontend
- Next.js
- Tailwind CSS
- shadcn/ui

### Backend
- Node.js
- Express.js

### AI
- Google Gemini API (free-tier compatible)

### Database & Auth
- Supabase (PostgreSQL + Authentication)

---

## How It Works
1. User pastes or uploads a medical document
2. The backend processes the text using an AI model
3. The system extracts and restructures key information
4. The frontend displays results in a clear, structured format

---

## Ethical Design

CarePath is built with strong ethical constraints:

- Does NOT diagnose conditions  
- Does NOT recommend treatments or medication changes  
- Encourages consultation with healthcare professionals  
- Clearly communicates limitations  
- Minimizes sensitive data storage  

The goal is to **support patient understanding**, not replace medical expertise.

---

## Hackathon Context

This project was developed as part of a hackathon focused on **Social Impact**, specifically within the **Biology & Physical Health** track.

The challenge emphasized:
- Solving real problems for specific users  
- Using AI to empower (not replace) people  
- Addressing ethical risks and safeguards  
- Building working prototypes with meaningful impact  

CarePath aligns with these goals by tackling a real-world healthcare communication gap and prioritizing patient empowerment.

---

## Future Improvements
- OCR for scanned medical documents (PDF/image support)
- Voice input for accessibility
- Integration with healthcare systems (EHRs)
- Personalized health tracking
- Expanded multilingual and cultural support

---

## Disclaimer
CarePath does not provide medical advice. Always consult a qualified healthcare professional for any medical decisions.

---

## License
This project is for educational and hackathon purposes. Further development should include compliance with healthcare data regulations.