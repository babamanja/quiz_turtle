# Language Turtle Monorepo

Telegram vocabulary bot (Language Turtle) with admin web panel and Paddle + Telegram Stars subscriptions.

## Workspaces

| Package | Description |
|---------|-------------|
| `bot/` | Telegram bot (Telegraf) |
| `backend/` | Express API, Prisma, auth, billing, admin |
| `frontend/` | React admin + user web (Vercel) |
| `packages/shared/` | Shared constants (pricing, limits) |

## Local development

1. Copy `env/.env.example` to `env/.env` and fill secrets.
2. Start Postgres: `docker compose up -d`
3. Apply schema: `npm run db:migrate --prefix backend`
4. Run services:
   - `npm run dev:backend`
   - `npm run dev:frontend`
   - `npm run dev:bot`

Or from the repo root: `npm run dev:all`

## Deploy

See [docs/HOSTING.md](docs/HOSTING.md): **Vercel** (SPA only) + shared Hetzner (Express + bot) + Neon.

### Vercel project settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `frontend` |
| **Include files outside Root Directory** | ON |
| **Framework Preset** | Vite |
| **Build / Output / Install** | Override OFF (`frontend/vercel.json`) |

Leave `VITE_API_BASE` empty. `/api` is rewritten to the Hetzner box.

## User identity

- User must have **email** (web signup) or **telegramId** (bot `/start`).
- Link both via web profile → Telegram deep link (`/api/telegram/link-code`).

## Payments

- **Paddle** — web checkout (`/my-subscription`)
- **Telegram Stars** — `/subscribe` in bot

## Admin

Web panel at `/admin/*`. Bootstrap admins via `ADMIN_EMAILS` or `ADMIN_TELEGRAM_IDS`.
