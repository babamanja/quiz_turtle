FROM node:22-bookworm-slim AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY bot/package.json bot/
COPY backend/prisma backend/prisma

RUN npm ci --workspace @language-turtle/shared --workspace language-turtle-bot --include-workspace-root
RUN npx prisma generate --schema backend/prisma/schema.prisma

COPY packages/shared packages/shared
COPY bot bot

RUN npm run build -w @language-turtle/shared && npm run build -w language-turtle-bot

WORKDIR /app/bot
CMD ["node", "dist/main.js"]
