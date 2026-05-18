# Contributing to CarePath

Thank you for your interest in contributing to CarePath. This guide outlines the development standards, security requirements, and workflow for making changes.

---

## Development Environment Setup

### Prerequisites

- Node.js 20+
- npm (do NOT use pnpm or yarn — the project is standardized on npm)
- A Supabase project (free tier is sufficient)
- A Google Gemini API key (free tier via [Google AI Studio](https://aistudio.google.com/apikey))

### Local Setup

```bash
# Clone the repository
git clone <repo-url>
cd care-path

# Backend
cd backend
cp .env.example .env
# Edit .env with your actual keys
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Database Setup

1. Go to your Supabase Dashboard → **SQL Editor**.
2. Paste the contents of `backend/database/migration.sql`.
3. Click **Run**.

---

## Code Quality Standards

### TypeScript Strictness

- The frontend uses `strict: true` in `tsconfig.json`.
- `next.config.mjs` has `ignoreBuildErrors: false` — all TypeScript errors must be resolved before merging.
- Avoid `any` types. Use explicit interfaces for API payloads.
- Handle all Promise rejections — no fire-and-forget async calls without `.catch()`.

### Input Validation

Every new backend endpoint **must** have a Zod schema:

```javascript
// In backend/middleware/validation.js
const newEndpointSchema = z.object({
  field: z.string().min(1).max(1000),
  flag: z.boolean(),
});

// In backend/routes/api.js
router.post('/new-endpoint', authMiddleware, validate(newEndpointSchema), controller);
```

### Error Handling

- **Backend**: Never return `err.message` or stack traces to clients. Log error codes/types only — never log raw medical text or user data (PHI).
- **Frontend**: Use try/catch around all API calls. Display user-friendly error messages.
- **Optimistic UI**: When implementing optimistic updates, always include error-reversion logic:

```typescript
const handleToggle = async (checked: boolean) => {
  // Optimistic update
  setState(checked);
  try {
    await apiCall(checked);
  } catch {
    // Revert on failure
    setState(!checked);
  }
};
```

### Authorization (BOLA Defense)

Every database query in a controller **must** be scoped to the authenticated user:

```javascript
// ✅ Correct — uses user-scoped client that respects RLS
const supabase = createUserClient(req.accessToken);
const { data } = await supabase
  .from('documents')
  .select('*')
  .eq('user_id', req.user.id);

// ❌ Wrong — bypasses RLS
const { data } = await supabaseAdmin
  .from('documents')
  .select('*')
  .eq('user_id', req.body.user_id); // user_id from request body is untrusted!
```

---

## Database Changes

When adding or modifying database tables:

1. **Add the migration** to `backend/database/migration.sql`.
2. **Enable RLS** on the new table.
3. **Add RLS policies** that check `auth.uid() = user_id`.
4. **Add indexes** on `user_id` for query performance.
5. **Document** the table's purpose in a comment block.

Example:

```sql
CREATE TABLE IF NOT EXISTS public.new_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ... fields ...
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_new_table_user_id ON public.new_table(user_id);
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON public.new_table FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Pull Request Checklist

Before submitting a PR, verify:

- [ ] All TypeScript errors are resolved (`npm run build` passes in frontend).
- [ ] New endpoints have Zod validation schemas.
- [ ] New database tables have RLS policies.
- [ ] Error handling follows PHI-safe logging patterns.
- [ ] No `.env` files or secrets are included in the commit.
- [ ] No `console.log` statements with raw medical text.
- [ ] All database queries use `createUserClient()` (not `supabaseAdmin`) for user-facing operations.
- [ ] Optimistic UI updates include reversion logic.

---

## Project Structure

```
care-path/
├── backend/
│   ├── index.js                # Express entry point
│   ├── routes/api.js           # Route definitions with validation
│   ├── controllers/            # Request handlers
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── optionalAuth.js     # Guest-friendly auth
│   │   ├── safety.js           # Emergency phrase detection
│   │   └── validation.js       # Zod schemas & validate()
│   ├── services/ai.js          # Gemini AI integration
│   ├── utils/supabase.js       # Supabase client utilities
│   └── database/migration.sql  # Database schema + RLS
├── frontend/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # Proxy routes to backend
│   │   ├── analyze/            # Analysis page
│   │   ├── history/            # History page
│   │   └── settings/           # User preferences
│   ├── components/
│   │   ├── carepath/           # Application components
│   │   └── ui/                 # shadcn/ui primitives
│   ├── context/auth.tsx        # Auth context provider
│   ├── lib/
│   │   ├── api.ts              # API client functions
│   │   ├── supabase.ts         # Browser Supabase client
│   │   └── utils.ts            # Utility functions
│   └── hooks/                  # Custom React hooks
├── docker-compose.yml          # Container orchestration
├── SECURITY.md                 # Security architecture & guidelines
└── CONTRIBUTING.md             # This file
```
