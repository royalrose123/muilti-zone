# syntax=docker/dockerfile:1
FROM node:20.20.2-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:20.20.2-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BUILD_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
ARG SHOP_ZONE_URL
ARG BLOG_ZONE_URL
RUN test -n "$SHOP_ZONE_URL" && test -n "$BLOG_ZONE_URL" || (echo "SHOP_ZONE_URL / BLOG_ZONE_URL build args are required" && exit 1)
ENV SHOP_ZONE_URL=$SHOP_ZONE_URL
ENV BLOG_ZONE_URL=$BLOG_ZONE_URL
RUN npm run build

FROM node:20.20.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
