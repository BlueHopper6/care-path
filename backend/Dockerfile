# 1. Install production dependencies only
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2. Minimal non-root production runtime
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS runner
WORKDIR /app

# Remove unused global package managers from runtime filesystem
RUN rm -rf /usr/local/lib/node_modules/npm /opt/yarn-* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg

ARG APP_REVISION=""
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_REVISION=$APP_REVISION

RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 --ingroup app app

COPY --chown=1001:1001 --from=deps /app/node_modules ./node_modules
COPY --chown=1001:1001 package.json index.js ./
COPY --chown=1001:1001 controllers ./controllers
COPY --chown=1001:1001 middleware ./middleware
COPY --chown=1001:1001 routes ./routes
COPY --chown=1001:1001 services ./services
COPY --chown=1001:1001 utils ./utils

USER 1001:1001
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=6s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health', {signal: AbortSignal.timeout(5000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "index.js"]
