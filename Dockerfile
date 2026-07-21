# syntax=docker/dockerfile:1

# ---- 1. deps: устанавливаем только зависимости (кэшируется отдельно от исходников) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. builder: собираем Next.js приложение ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Переменные, нужные во время build (next build). Секреты сюда не передаём —
# NEXT_PUBLIC_* значения по умолчанию, реальные — через --build-arg при необходимости.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- 3. runner: минимальный рантайм-образ ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Непривилегированный пользователь
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next.js standalone-сборка — минимальный набор файлов для запуска
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
