# Auth App

A self-contained Next.js authentication system: email/password auth with
email verification, password reset, OAuth (Google + GitHub), and JWT-based
sessions — no NextAuth/Clerk, so every step of the flow is implemented and
readable in this repo.

## Features

- Register / login with email + password (bcrypt, cost 12)
- Email verification (required before login) with resend support
- Forgot / reset password with single-use, hashed, expiring tokens
- OAuth sign-in via Google and GitHub (manual authorization-code flow, CSRF-protected via `state`)
- Short-lived JWT access tokens in HTTP-only cookies, verified in `src/proxy.ts` (route protection middleware)
- Rate limiting on login, register, forgot-password, and resend-verification
- Prisma + PostgreSQL

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — a PostgreSQL connection string
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate with `openssl rand -base64 64`
   - `RESEND_API_KEY` / `EMAIL_FROM` — optional in dev; emails log to the console if unset
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — optional, only needed if you want OAuth sign-in

3. Run database migrations:

   ```bash
   npx prisma migrate dev
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `src/app/(auth)/` — login, register, forgot/reset password, verify-email pages
- `src/app/(protected)/` — routes that require an authenticated session (e.g. dashboard)
- `src/app/api/auth/` — auth API routes (register, login, logout, me, oauth, verify-email, reset-password, etc.)
- `src/lib/auth/` — password hashing, JWT signing/verification, session cookies, token generation, OAuth provider logic
- `src/lib/email/` — transactional email sending + templates
- `src/lib/rate-limit.ts` — in-memory rate limiter for auth endpoints
- `src/proxy.ts` — middleware that redirects unauthenticated users away from protected routes
- `prisma/schema.prisma` — database schema

## Known limitations

- Rate limiting is in-memory (per-instance) — swap for something like Upstash Ratelimit before running multiple instances.
- Refresh-token plumbing exists (`Session` model, JWT helpers) but isn't wired into any route yet — access tokens currently expire after 15 minutes with no silent refresh.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — start the production server
- `npm run lint` — run ESLint
