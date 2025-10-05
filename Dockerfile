FROM oven/bun:latest AS base

# Prisma's library engine requires OpenSSL 3 (libssl.so.3)
# Install minimal runtime libraries for Debian-based Bun image
RUN apt-get update \
  && apt-get install -y --no-install-recommends libssl3 openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

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