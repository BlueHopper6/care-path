# CarePath Backend API

AI-powered healthcare navigation API that converts medical documents into plain-language summaries, action plans, doctor questions, and warning signs.

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your actual keys
```

You need:
- **Supabase**: Create a project at [supabase.com](https://supabase.com). Get the URL, anon key, and service role key from Settings → API.
- **Gemini API Key**: Get one free at [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Set up the database

1. Go to your Supabase Dashboard → **SQL Editor**
2. Copy and paste the contents of `database/migration.sql`
3. Click **Run**

### 4. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API runs on `http://localhost:3001` by default.

---

## API Endpoints

### Health Check

```
GET /api/health
```

### Analyze Medical Text (Public)

```
POST /api/analyze
Content-Type: application/json

{
  "raw_text": "Patient discharged with metformin 500mg twice daily...",
  "mode": "simple",       // optional: "default" or "simple"
  "language": "Spanish"   // optional: output language
}
```

Query parameter alternative for mode: `POST /api/analyze?mode=simple`

### Analyze & Save (Authenticated)

```
POST /api/analyze/save
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "raw_text": "...",
  "analysis": { ... },
  "mode": "default",
  "language": "English"
}
```

### File Upload & Parsing (Public)

```
POST /api/parse-file
Content-Type: multipart/form-data

form-data key: "file" (File blob - PDF or TXT)
```

### Save Legacy Document (Authenticated)

```
POST /api/upload
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "raw_text": "..."
}
```

### User Preferences (Authenticated)

```
GET /api/preferences
Authorization: Bearer <supabase-access-token>

PUT /api/preferences
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "auto_save_history": true
}
```

### Get History (Authenticated)

```
GET /api/history?page=1&limit=20
Authorization: Bearer <supabase-access-token>
```

---

## Example cURL

```bash
# Quick test (no auth needed)
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "raw_text": "Patient discharged after appendectomy. Take ibuprofen 400mg every 6 hours for pain. Follow up with surgeon in 2 weeks. Call if you have fever above 101F, increasing pain, or redness at the incision site."
  }'

# Simple mode
curl -X POST "http://localhost:3001/api/analyze?mode=simple" \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "Patient prescribed metformin 500mg BID for T2DM management."}'
```

---

## Project Structure

```
backend/
├── index.js              # Express app entry point
├── package.json
├── .env.example
├── database/
│   └── migration.sql     # Supabase table definitions + RLS
├── routes/
│   └── api.js            # Route definitions
├── controllers/
│   ├── analyze.js        # POST /api/analyze logic
│   └── documents.js      # POST /api/upload, GET /api/history
├── services/
│   └── ai.js             # Gemini AI integration
├── middleware/
│   ├── auth.js           # Supabase JWT verification
│   └── safety.js         # Emergency phrase detection
└── utils/
    └── supabase.js       # Supabase client utilities
```

---

## Safety Features

- **Emergency detection**: Automatically detects phrases like "chest pain", "trouble breathing", "severe bleeding", etc. and prepends urgent warnings.
- **No diagnosis rule**: The AI prompt strictly prevents diagnosis or medication recommendations.
- **Disclaimer**: Every response includes a medical disclaimer.
- **Rate limiting**: 100 requests per 15 minutes per IP.
