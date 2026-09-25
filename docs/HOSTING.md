# Hosting

Same split as workflows: **Vercel = SPA only**, **Hetzner = long-lived Express + Telegram bot**.

Do not run Express on Vercel.

## Layout

```text
Browser
  → React SPA        Vercel (frontend/)
       /api/*        rewrite → https://turtle.91.107.200.153.sslip.io/api/*
  → Express API      Hetzner (shared box, port 3001)
  → Telegram bot     same box (polling, no public port)
       → Postgres    Neon (direct URL, not the pooler)
```

The box already serves workflows on `https://91.107.200.153.sslip.io` → `:7842`. Language Turtle uses a **different Host and port**:

| App | Public host | Local port |
|---|---|---|
| workflows | `91.107.200.153.sslip.io` | `7842` |
| language-turtle | `turtle.91.107.200.153.sslip.io` | `3001` |

## Frontend (Vercel)

1. Import the repo on [vercel.com](https://vercel.com).
2. **Root Directory:** `frontend`
3. Enable **Include source files outside of the Root Directory in the Build Step** (workspace `@language-turtle/shared`).
4. **Framework Preset:** Vite
5. Leave Install / Build / Output overrides **off** — `frontend/vercel.json` sets them.

Leave `VITE_API_BASE` **empty**. The browser calls same-origin `/api`, Vercel rewrites to Hetzner, refresh cookies stay first-party.

Set only public `VITE_*` vars (Google client id, Paddle client token, PostHog). Do **not** put `DATABASE_URL`, JWT secrets, or Paddle webhook secret on Vercel.

## Hetzner (shared with workflows)

Caddy (or nginx) extra site — do not replace the workflows site:

```caddy
turtle.91.107.200.153.sslip.io {
  reverse_proxy 127.0.0.1:3001
}
```

Two processes on the box:

- API: `backend` on `:3001` (`npm run start:prod` or `backend/Dockerfile`)
- Bot: `bot` polling (`bot/Dockerfile`). `BACKEND_INTERNAL_URL=http://127.0.0.1:3001`

On API env:

```env
APP_ENV=prod
PORT=3001
CORS_ORIGINS=https://your-app.vercel.app
AUTH_PUBLIC_APP_URL=https://your-app.vercel.app
COOKIE_SECURE=true
COOKIE_SAMESITE=none
DATABASE_URL=postgresql://...neon.tech/...sslmode=require
```

`COOKIE_SAMESITE=none` is required if anything talks to the API host directly. Same-origin Vercel rewrites also accept it (`Secure` must be true).

Paddle webhook URL (dashboard, **not** via Vercel rewrite):

`https://turtle.91.107.200.153.sslip.io/api/subscriptions/provider/paddle/webhook`

Migrate on the box, not on Vercel:

```bash
npm run db:deploy --prefix backend
```

Use Neon's **direct** connection string (`pg.Pool` / Prisma on a long-lived process). Keep Docker Postgres for local only.

## Local

Unchanged: `docker compose up -d`, then `dev:backend` / `dev:frontend` / `dev:bot`. Vite proxies `/api` to the local Express port.
