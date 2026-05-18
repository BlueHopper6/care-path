FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies for build
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Next.js requires NEXT_PUBLIC variables at build time to embed them into the client-side bundles
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Build the Next.js application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install only production dependencies to keep image small
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Copy built assets from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# Expose frontend port
EXPOSE 5173

# Start Next.js production server
CMD ["npm", "start"]
