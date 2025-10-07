FROM oven/bun:latest AS base

WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma

RUN bun install --frozen-lockfile
RUN bun x prisma generate

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]