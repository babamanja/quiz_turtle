# Language Turtle Monorepo

Telegram vocabulary bot (Language Turtle) with admin web panel and Paddle + Telegram Stars subscriptions.

## Workspaces

| Package | Description |
|---------|-------------|
| `bot/` | Telegram bot (Telegraf) |
| `backend/` | Express API, Prisma, auth, billing, admin |
| `frontend/` | React admin + user web (Vercel) |
| `packages/shared/` | Shared constants (pricing, limits) |
| `api/` | Vercel serverless entry |

## Local development

1. Copy `env/.env.example` to `env/.env` and fill secrets.
2. Start Postgres: `docker compose up db -d`
3. Apply schema: `npm run db:migrate --prefix backend`
4. Run services:
   - `npm run dev:backend`
   - `npm run dev:frontend`
   - `npm run dev:bot`

## Deploy (Vercel)

Monorepo deploys from the **repository root**.

### Vercel project settings

| Setting | Value |
|---------|--------|
| **Root Directory** | *(empty — repository root)* |
| **Framework Preset** | Other |
| **Build Command** | **Override OFF** (empty) |
| **Output Directory** | **Override OFF** (empty) |
| **Install Command** | **Override OFF** (empty) |

Everything is driven by root `vercel.json`: `@vercel/static-build` for the Vite SPA, `@vercel/node` for `api/index.ts`.

Set env vars from `backend/.env.example` and `frontend/.env.example` in the Vercel dashboard.

## User identity

- User must have **email** (web signup) or **telegramId** (bot `/start`).
- Link both via web profile → Telegram deep link (`/api/telegram/link-code`).

## Payments

- **Paddle** — web checkout (`/my-subscription`)
- **Telegram Stars** — `/subscribe` in bot

## Admin

Web panel at `/admin/*`. Bootstrap admins via `ADMIN_EMAILS` or `ADMIN_TELEGRAM_IDS`.
