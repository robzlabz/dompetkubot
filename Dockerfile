# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# Copy manifests and Prisma schema first for better layer caching
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install deps and generate Prisma client
RUN bun install --frozen-lockfile
RUN bun x prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Environment
ENV NODE_ENV=production

# The bot uses Telegram + OpenAI; provide these at runtime:
#   TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, DATABASE_URL

# Start the bot (Bun runs TS directly)
CMD ["bun", "run", "src/index.ts"]