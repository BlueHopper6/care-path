# CarePath Project Structure & Technical Documentation

This document provides deep technical documentation for developers, detailing component trees, architecture, database schemas, API contracts, and the implementation details of the application's features.

## High-Level Architecture
CarePath uses a decoupled architecture with a Next.js frontend and an Express.js backend.
- **Frontend:** Next.js 16 App Router, Tailwind CSS 4, Radix UI, TypeScript
- **Backend:** Node.js 20, Express.js
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **AI Integration:** Google Gemini 2.5 Flash

## Repository Structure

```
care-path/
├── backend/                  # Express.js API server
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/       # Validation, rate-limiting, error handling
│   │   ├── routes/           # API route definitions
│   │   ├── services/         # Business logic (AI processing, DB interactions)
│   │   └── utils/            # Helper functions
│   └── database/             # Supabase SQL migrations/schemas
├── frontend/                 # Next.js Application
│   ├── app/                  # Next.js App Router pages
│   │   ├── analyze/          # Document analysis UI
│   │   ├── history/          # User history viewer
│   │   ├── privacy/          # Privacy Policy page
│   │   ├── settings/         # User preferences
│   │   └── terms/            # Terms of Service & Legal Disclaimer
│   ├── components/           # Reusable React components (shadcn/ui + custom)
│   ├── context/              # React Context providers (Auth, Theme)
│   ├── hooks/                # Custom React hooks
│   └── lib/                  # Utility functions (utils.ts, api client)
└── test-data/                # Sample medical documents for testing
```

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
