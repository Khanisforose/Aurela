# Multi-stage production Dockerfile for Aurela (Next.js 15)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
# Note: NOT using --frozen-lockfile so small package.json edits don't break VPS deploys.
# Yarn will regenerate yarn.lock if needed. Trade-off: not perfectly reproducible builds,
# acceptable for MVP. Add --frozen-lockfile back once the app stabilises.
RUN yarn install --network-timeout 600000

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
USER nextjs
EXPOSE 3000
# Use next start directly (not "yarn start") so the "output: standalone" warning is gone
# and startup is faster. Falls back to yarn start if next binary isn't found.
CMD ["node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
