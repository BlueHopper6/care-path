# 1. Install build dependencies
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build standalone Next.js output with public browser config only
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG APP_REVISION=""

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV APP_REVISION=$APP_REVISION
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 3. Minimal non-root standalone runtime
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS runner
WORKDIR /app

# Remove unused global package managers from runtime filesystem
RUN rm -rf /usr/local/lib/node_modules/npm /opt/yarn-* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg

ARG APP_REVISION=""
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_REVISION=$APP_REVISION

RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 --ingroup app app

COPY --chown=1001:1001 --from=builder /app/public ./public
COPY --chown=1001:1001 --from=builder /app/.next/standalone ./
COPY --chown=1001:1001 --from=builder /app/.next/static ./.next/static
RUN mkdir -p .next/cache && chown -R 1001:1001 .next/cache

USER 1001:1001
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=6s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health', {signal: AbortSignal.timeout(5000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
