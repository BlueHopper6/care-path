# CarePath

**AI-Powered Healthcare Navigation Platform**

CarePath transforms complex medical documents — discharge summaries, lab reports, and treatment instructions — into clear, structured, and actionable information. It empowers patients to understand their care without replacing professional medical advice.

---

## Architecture

CarePath uses a decoupled client-server architecture with a secure data layer:

```
┌─────────────────────────┐     HTTPS      ┌────────────────────────┐
│   Next.js Frontend      │ ◄────────────► │   Express.js Backend   │
│   (App Router, Tailwind,│   API Proxy    │   (Validation, Safety, │
│    Radix UI, TypeScript)│                │    Rate Limiting)      │
└────────────┬────────────┘                └──────┬────────┬────────┘
             │                                    │        │
             │ Auth (JWT)                   AI    │        │ RLS
             ▼                                    ▼        ▼
     ┌───────────────┐                   ┌──────────┐ ┌──────────┐
     │   Supabase    │                   │  Gemini  │ │ Supabase │
     │   Auth        │                   │  2.5     │ │ Postgres │
     └───────────────┘                   │  Flash   │ │ (RLS)    │
                                         └──────────┘ └──────────┘
```

| Layer | Stack |
|-------|-------|
| **Frontend** | Next.js 16 (App Router), Tailwind CSS 4, TypeScript, Radix UI, shadcn/ui, React Hook Form, Zod |
| **Backend** | Node.js 20, Express.js, Zod validation, Helmet, express-rate-limit |
| **Database & Auth** | Supabase (PostgreSQL with Row Level Security, JWT Auth) |
| **AI** | Google Gemini API (gemini-2.5-flash) |
| **Infrastructure** | Docker Compose, Cloudflare Tunnels |

---

## Core Features

- **Medical Document Simplification** — Upload PDFs, TXT files, or paste clinical text. CarePath converts it into plain-language summaries, action plans, and warning signs.
- **"Explain Like I'm 12" Mode** — Further simplifies output to a 6th-grade reading level for maximum accessibility.
- **Multilingual Output** — Supports English, Spanish, French, German, Chinese, Arabic, Hindi, and Portuguese.
- **Recurring Task Extraction** — Automatically identifies repeating medical obligations (medications, follow-ups) and generates Google Calendar events with RRULE scheduling.
- **Privacy-First History** — Explicit consent flow for data persistence. Guests get 24-hour auto-expiring local storage. Authenticated users get encrypted server-side storage with full RLS protection.
- **Printable Export** — Generate clean, dependency-free PDF reports for caregivers and clinical visits.
- **Emergency Detection** — Rule-based safety middleware detects emergency symptoms (chest pain, breathing difficulty, stroke, overdose) and injects urgent warnings into results.

---

## Security & Compliance

CarePath implements defense-in-depth security appropriate for healthcare data:

### Input Validation
- **Zod schemas** enforce strict payload validation on all POST/PUT routes.
- HTML tags are stripped from text inputs to prevent stored XSS.
- Request body sizes are bounded (1 MB JSON, 5 MB file uploads).

### File Upload Security
- Multer rejects non-PDF/TXT MIME types.
- **Magic byte validation** verifies actual file content (PDF must start with `%PDF`, TXT must not contain null bytes) — client-reported MIME types are never trusted alone.
- PDF parsing has a 30-second timeout to prevent CPU exhaustion.

### Authentication & Authorization
- Supabase JWT-based auth with Bearer token verification.
- **Row Level Security (RLS)** on all database tables — users can only access their own data.
- All database queries use user-scoped clients (`createUserClient`) that respect RLS.
- JWT format pre-validation before hitting Supabase API.

### Rate Limiting
- **General**: 200 requests / 15 minutes (metadata, preferences, history).
- **Compute**: 15 requests / 15 minutes (AI analysis, file parsing).
- `trust proxy` configured for accurate IP detection behind Cloudflare/nginx.

### Security Headers
- Helmet with explicit CSP (`default-src 'self'`, `frame-ancestors 'none'`).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` disabling camera, microphone, and geolocation.
- CORS strictly locked to `FRONTEND_URL` — no wildcard origins.

### PHI Protection
- Error handlers never log raw medical text or user data.
- Client error responses contain generic messages only — no stack traces or internal details.
- Guest localStorage history auto-expires after 24 hours.

### Ethical AI Framework
- The AI prompt enforces a strict **No-Diagnosis Policy**: CarePath never diagnoses conditions, recommends medication changes, or suggests treatments.
- All outputs are framed as "what the document says" — not medical opinions.
- Every response includes a medical disclaimer.
- Emergency detection middleware runs **before** AI analysis and injects safety warnings for critical symptoms.

---

## Setup & Deployment

### Prerequisites

- Node.js 20+
- npm
- [Supabase](https://supabase.com) project (free tier)
- [Google Gemini API key](https://aistudio.google.com/apikey) (free tier)

### Local Development

```bash
# 1. Clone and configure
git clone <repo-url>
cd care-path
cp .env.example .env
# Edit .env with your actual keys

# 2. Set up the database
# Go to Supabase Dashboard → SQL Editor
# Paste contents of backend/database/migration.sql → Run

# 3. Start backend
cd backend
cp .env.example .env
# Edit .env with your actual keys
npm install
npm run dev

# 4. Start frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables

#### Root `.env` (Docker Compose)

| Variable | Description | Used By |
|----------|-------------|---------|
| `FRONTEND_URL` | Frontend domain for CORS | Backend |
| `NEXT_PUBLIC_API_URL` | Backend API URL | Frontend |
| `SUPABASE_URL` | Supabase project URL | Backend |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | Backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Backend |
| `GEMINI_API_KEY` | Google Gemini API key | Backend |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (client) | Frontend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client) | Frontend |

### Docker Compose Deployment

```bash
# Build and start all services
docker compose up --build -d

# Services:
# - Backend:  http://localhost:3000
# - Frontend: http://localhost:5173
```

---

## API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/analyze` | Analyze medical text (optional auth for history) |
| `POST` | `/api/parse-file` | Extract text from PDF/TXT uploads |

### Authenticated Endpoints

All require `Authorization: Bearer <supabase-access-token>` header.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/analyze/save` | Save analysis to user history |
| `POST` | `/api/upload` | Store raw document text |
| `GET` | `/api/history` | Retrieve past analyses (paginated) |
| `GET` | `/api/preferences` | Get user preferences |
| `PUT` | `/api/preferences` | Update user preferences |

### Example

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "raw_text": "Patient discharged after appendectomy. Take ibuprofen 400mg every 6 hours for pain. Follow up with surgeon in 2 weeks.",
    "mode": "simple",
    "language": "English"
  }'
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development standards, security requirements, and PR checklist.

## Security

See [SECURITY.md](SECURITY.md) for the security architecture, vulnerability reporting process, and HIPAA-aligned development guidelines.

## ⚠️ Legal Disclaimer & Terms of Use

**CRITICAL NOTICE: NOT MEDICAL ADVICE**

CarePath is an **educational computer science and hackathon project**. It is absolutely NOT a medical device, diagnostic tool, or replacement for professional medical advice. By using, deploying, or interacting with this software, you acknowledge and agree to the following:

1.  **No Medical Advice:** The content generated by CarePath (including summaries, action plans, and warning signs) is produced by artificial intelligence for educational purposes only. It does not constitute medical advice, diagnosis, or treatment.
2.  **No Liability:** Under no circumstances shall the creator(s), developers, or maintainers of CarePath be liable for any direct, indirect, incidental, consequential, special, or exemplary damages arising from the use of this software. This includes, but is not limited to, adverse medical outcomes, injury, death, data loss, or privacy breaches.
3.  **Data Privacy (Not HIPAA Compliant):** This application is a portfolio project and is **NOT HIPAA compliant**. Users upload personal or medical documents at their own risk. The creators guarantee no absolute security of data against unauthorized breaches.
4.  **AI Inaccuracies:** The application relies on Large Language Models (LLMs) which can hallucinate, make mistakes, or misinterpret complex medical jargon. Users must verify all outputs with their healthcare provider.
5.  **"As-Is" Software:** CarePath is provided "AS IS", without warranty of any kind, express or implied.

**If you think you may have a medical emergency, call your doctor or emergency services immediately.**

## License

MIT