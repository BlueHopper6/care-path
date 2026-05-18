# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in CarePath, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities.
2. Email the maintainer directly with a detailed description of the vulnerability.
3. Include steps to reproduce, potential impact, and any suggested fixes.
4. Allow reasonable time for the issue to be addressed before any public disclosure.

---

## Security Architecture

### Authentication & Authorization

CarePath uses Supabase Auth with JWT-based bearer tokens. The backend enforces a strict authorization model:

- **Row Level Security (RLS)**: Every database table (`users`, `documents`, `analyses`) has RLS policies that restrict access to `auth.uid() = user_id`. This is the primary authorization boundary.
- **User-Scoped Clients**: All authenticated database operations use `createUserClient(accessToken)`, which creates a Supabase client bound to the user's JWT. This ensures RLS policies are enforced on every query.
- **BOLA/IDOR Defense**: All write operations explicitly set `user_id: req.user.id` and all reads are filtered by the same. Even if an attacker submits a crafted `user_id`, RLS will reject the operation.

### Input Validation

All POST/PUT endpoints use **Zod schemas** for strict request validation:

- Payloads are validated before reaching controllers.
- HTML tags are stripped from text inputs to prevent stored XSS.
- String lengths are bounded to prevent DoS via oversized payloads.
- Type coercion is explicit — no implicit `any` values pass through.

### File Upload Security

The `/api/parse-file` endpoint implements defense-in-depth for file uploads:

1. **Multer `fileFilter`**: Rejects files whose client-reported MIME type is not `application/pdf` or `text/plain`.
2. **Magic Byte Validation**: After Multer accepts the file, the server validates the actual file content — PDFs must start with `%PDF`, text files must not contain null bytes. This prevents MIME spoofing attacks.
3. **Size Limit**: 5 MB maximum (memory storage, no disk writes).
4. **Parse Timeout**: PDF parsing has a 30-second timeout to prevent CPU exhaustion from malicious PDFs.

### Rate Limiting

Two-tier rate limiting protects the API:

| Tier | Limit | Applies To |
|------|-------|-----------|
| General | 200 req / 15 min | All endpoints |
| Compute | 15 req / 15 min | `/api/analyze`, `/api/parse-file` |

Rate limiting uses `trust proxy` configuration for correct client IP detection behind reverse proxies (Cloudflare, nginx).

### Security Headers

The backend uses Helmet with an explicit Content Security Policy:

- `default-src 'self'` — No external resource loading.
- `frame-ancestors 'none'` — Prevents clickjacking.
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `X-Permitted-Cross-Domain-Policies: none`

The frontend adds additional headers via Next.js config:

- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### CORS

CORS is strictly configured to accept requests only from `process.env.FRONTEND_URL`. No wildcard (`*`) origins are permitted. The fallback default is `http://localhost:5173` (development only).

### Error Handling & Logging

- **No PHI in Logs**: Error handlers log error type and code only — never raw medical text, user data, or full stack traces.
- **No Internal Details to Clients**: Error responses contain generic messages only. Stack traces, database errors, and API keys are never returned.
- **Supabase Errors**: Only error codes and hints are logged, not full error objects that may contain query parameters or user data.

---

## Development Security Guidelines

### For New Endpoints

1. **Always add a Zod schema** in `backend/middleware/validation.js` and apply `validate(schema)` in the route definition.
2. **Always use `createUserClient(req.accessToken)`** for database operations — never `supabaseAdmin` for user-facing queries.
3. **Always set `user_id: req.user.id`** on insert operations — never accept `user_id` from the request body.
4. **Always scope reads** with `.eq('user_id', req.user.id)`.

### For New Database Tables

1. **Enable RLS**: `ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;`
2. **Add policies** for SELECT, INSERT, UPDATE, DELETE as needed, always using `auth.uid() = user_id`.
3. **Add indexes** on `user_id` for performance.
4. **Document** the migration in `backend/database/migration.sql`.

### HIPAA-Aligned Guidelines

While CarePath is not currently HIPAA-certified, these practices prepare the codebase for compliance:

1. **Minimize Data Storage**: Store only what is necessary. Raw medical text is stored only when the user explicitly consents.
2. **No PHI in Logs**: Never log patient medical text, names, or identifiers.
3. **Encryption in Transit**: All production traffic must use HTTPS (enforced by Cloudflare).
4. **Access Controls**: RLS provides row-level access control. No user can access another user's data.
5. **Data Retention**: Guest localStorage history auto-expires after 24 hours. Server-side data can be deleted by the user.
6. **Audit Trail**: Database tables include `created_at` timestamps for all records.

### Secrets Management

1. **Never commit `.env` files** — they are listed in `.gitignore` at both root and backend levels.
2. **Use `.env.example`** files to document required variables with placeholder values only.
3. **Rotate keys immediately** if any secret is accidentally committed.
4. **Use different keys** for development and production environments.

---

## Dependency Security

- Run `npm audit` regularly to check for known vulnerabilities.
- Pin major versions in `package.json` to prevent unexpected breaking changes.
- Review dependency changelogs before upgrading.
- The frontend uses a single package manager (npm) — do not introduce `pnpm-lock.yaml` or `yarn.lock`.
