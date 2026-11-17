# CarePath Project Structure & Technical Documentation

This document provides deep technical documentation for developers, detailing component trees, architecture, database schemas, API contracts, and the implementation details of the application's features.

## High-Level Architecture
CarePath uses a decoupled architecture with a Next.js standalone frontend and an Express.js backend.
- **Frontend:** Next.js 16 App Router (standalone server on port 3000), Tailwind CSS 4, Radix UI, TypeScript
- **Backend:** Node.js 24, Express.js (internal port 3000, no published host port in VM slots)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **AI Integration:** Google Gemini 2.5 Flash
- **Guest Rollout Boundary:** Isolated per-slot Docker bridge networks (`carepath-blue-net`, `carepath-green-net`), loopback frontend slots (`127.0.0.1:3301`, `127.0.0.1:3302`), dedicated unprivileged Traefik router (`127.0.0.1:3400` / `:3401`), and unprivileged webhook receiver (`127.0.0.1:3410`).

## Repository Structure

```
care-path/
├── .github/workflows/        # CI verification (verify.yaml) and private GHCR publication (deploy.yaml)
├── backend/                  # Express.js API server
│   ├── controllers/          # Route handlers (analyze, documents, fileParser, preferences)
│   ├── database/             # Supabase SQL migrations/schemas
│   ├── middleware/           # Validation, auth, optionalAuth, safety
│   ├── routes/               # API route definitions
│   ├── services/             # Business logic (AI processing)
│   ├── tests/                # Node test suite (api.test.js)
│   └── utils/                # Structured stdout JSON logger, Supabase clients
├── deployment/               # Guest verifier, rollout state machine, runtime, router, webhook receiver, systemd units
│   └── systemd/              # Hardened systemd units for router, events, worker, boot, monitor, timers
├── frontend/                 # Next.js Application
│   ├── app/                  # Next.js App Router pages and server-side API proxy routes
│   │   ├── analyze/          # Document analysis UI
│   │   ├── api/              # Route handlers (analyze, analyze/save, health, history, parse-file, preferences)
│   │   ├── history/          # User history viewer
│   │   ├── privacy/          # Privacy Policy page
│   │   ├── settings/         # User preferences
│   │   └── terms/            # Terms of Service & Legal Disclaimer
│   ├── components/           # Reusable React components (shadcn/ui + custom)
│   ├── context/              # React Context providers (Auth, Theme)
│   ├── hooks/                # Custom React hooks
│   └── lib/                  # Shared client/server utilities (api.ts, backend.ts, supabase.ts, utils.ts)
├── scripts/                  # Release manifest generator & private GHCR visibility verifier
└── tests/                    # Release manifest & Python rollout/verifier/router/events tests
```

## Production Isolation & Deployment Flow

1. **Server-Side API Proxy (`frontend/lib/backend.ts`)**: All `/api/*` Route Handlers resolve `INTERNAL_API_URL` at runtime (never baked into client bundles), validate `CF-Connecting-IP` / `X-Forwarded-For` before forwarding `X-Forwarded-For` to Express, enforce upload byte limits (`6 MiB` multipart ceiling on `/api/parse-file`), and apply explicit `AbortSignal.timeout` bounds.
2. **Health & Readiness**: `GET /api/health` on backend verifies required configuration (`GEMINI_API_KEY`, HTTPS `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FRONTEND_URL` in production) without calling Gemini; `GET /api/health` on frontend validates public Supabase config and probes the slot's backend `/api/health`.
3. **Logging & Container Hardening**: Production logs emit redacted JSON to stdout (no container filesystem log rotation, no stack traces, no Gemini response previews). Both containers run as UID/GID `1001:1001` with `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, `--pids-limit=128`, bounded tmpfs mounts, and Docker `local` log caps (`10m x 3`).
4. **Two-Image Release Manifest (`scripts/release-manifest.mjs`)**: Binds `revision`, `verificationRunId`, `releaseRunId`, and immutable digests for both `ghcr.io/bluehopper6/carepath-frontend` and `ghcr.io/bluehopper6/carepath-backend`.
5. **Guest Rollout (`deployment/carepath_rollout.py`)**: Independently authenticates GitHub workflow/artifact provenance, pulls both digests, enforces VM memory/disk headroom (`MemAvailable >= 1280 MiB`, `>= 2 GiB` disk), boots the inactive slot pair (`blue` or `green`), verifies `/api/health`, switches Traefik (`127.0.0.1:3400`), observes health for 30s (with automatic rollback on failure), drains for 70s, and stops the prior slot.

## Recently Added Features

### Privacy Policy Integration
A comprehensive Privacy Policy page has been added to transparently communicate data handling practices and the educational, non-HIPAA-compliant nature of the platform.

**Technical Implementation:**
- Added `frontend/app/privacy/page.tsx` containing the Privacy Policy content matching the structural and aesthetic design of the Terms of Service page.
- Updated `frontend/app/page.tsx` footer to link to the new Privacy Policy.
- Updated `frontend/app/terms/page.tsx` footer to link to the Privacy Policy.
- Updated `README.md` to reference the Privacy Policy in the Legal Disclaimer section.

## Authentication Flow
1. Client requests authentication via Supabase Auth (JWT).
2. Supabase returns a session containing an access token (Bearer).
3. Client attaches the access token to the `Authorization` header for all protected API requests.
4. Backend verifies the token using Supabase client instances.
5. If valid, the request proceeds and database queries are executed using user-scoped clients, enforcing Row Level Security (RLS).

## API Contracts

### `POST /api/analyze`
**Description:** Analyzes medical text.
- **Request Body:**
  ```json
  {
    "raw_text": "string",
    "mode": "simple | standard",
    "language": "string"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "summary": "string",
    "action_plan": ["string"],
    "warning_signs": ["string"]
  }
  ```

### `POST /api/analyze/save` (Protected)
**Description:** Saves an analysis result to the authenticated user's history.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:** Analysis payload.
- **Response (200 OK):** Database record ID.

## Database Schema (Supabase PostgreSQL)
*Note: This is an architectural summary. For exact schemas, refer to `backend/database/migration.sql`.*

- **users:** Managed by Supabase Auth (`auth.users`).
- **analyses:** Stores past medical document analyses.
  - `id`: UUID (Primary Key)
  - `user_id`: UUID (Foreign Key to auth.users)
  - `raw_text`: Text
  - `summary`: Text
  - `action_plan`: JSONB
  - `warning_signs`: JSONB
  - `created_at`: Timestamp
  - **RLS Policy:** `user_id = auth.uid()`

## Component Tree (Frontend Core)

```
RootLayout
├── ThemeProvider
├── AuthProvider
└── Navbar
    ├── NavigationLinks
    └── AuthButtons
Page Components
├── LandingPage (app/page.tsx)
├── AnalyzePage (app/analyze/page.tsx)
│   ├── FileUploader
│   ├── TextEditor
│   └── ResultsDisplay
├── HistoryPage (app/history/page.tsx)
├── TermsPage (app/terms/page.tsx)
└── PrivacyPolicyPage (app/privacy/page.tsx)
```
