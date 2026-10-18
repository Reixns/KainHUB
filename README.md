# KainHUB

Marketplace app built with React, Vite, and Supabase.

## Live deployment

- App: <https://kainhub-cyan.vercel.app>
- GitHub: <https://github.com/Reixns/KainHUB>
- Vercel project: `kainhub`, connected to the `main` branch

## Local development

Use Node.js 22.12 or newer in the Node 22 line, and npm. Install dependencies
and configure the public Supabase browser credentials:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` with the Supabase project URL and anon/publishable key, then start
the development server:

```powershell
npm run dev
```

Available checks:

```powershell
npm run lint
npm run typecheck
npm run build
npm run preview
```

Never put a Supabase `service_role` or secret key in a `VITE_*` variable. Vite
embeds `VITE_*` values in the browser bundle. Local `.env*` files are ignored by
Git; `.env.example` contains placeholders only.
The `VITE_SUPABASE_ANON_KEY` is a public publishable key and is expected to be
visible in the browser; protect database data with Row Level Security (RLS).
Auth, database, and storage requests go through the same-origin Vercel Function
in `api/supabase/[...path].js`. The browser never receives the Supabase access
or refresh token: the server encrypts them into a role-specific `HttpOnly`,
`Secure` (on HTTPS), `SameSite=Lax` cookie and strips browser Authorization
headers before proxying. The SDK keeps only an opaque placeholder in the
tab-scoped `sessionStorage`; opening DevTools can show that placeholder and the
encrypted cookie, but not the Supabase access token. A person controlling the
browser/device can still inspect browser traffic and cookies.

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SESSION_ENCRYPTION_KEY` as server
environment variables in Vercel (for Production, Preview, and Development).
The anon key is public and is not a service-role key. Generate the encryption
key locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep `SESSION_ENCRYPTION_KEY` only in server environment settings or a local
ignored `.env` file; never prefix it with `VITE_` or commit it. Local Vite dev
uses the same BFF and requires those server variables. Supabase Realtime
WebSockets are replaced by 15-second polling so browser requests do not need
the access token. Image uploads are limited to 4 MB to fit Vercel Function
request-body limits while passing through the BFF.

## Supabase account data

The database follows the customer, vendor, and admin portal workflows.
`profiles` stores the shared Auth identity and role/status; `customer_profiles`,
`vendor_profiles`, and `admin_profiles` store role-specific personal details.
`vendors` remains the separate shop/business record. Table descriptions in
[`supabase/schema.sql`](./supabase/schema.sql) label each table with the portal
that uses it and its role in the workflow.

See [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md) for portal-by-portal data
flows, access notes, entity relationships, and the field/type dictionary.
Existing marketplace table names are retained for compatibility with the app.
Database triggers record cross-portal changes in `activity_logs`, which is
readable only by admins and powers the Admin Audit Logs page.

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor
to create or reconcile the complete schema, including role-specific profile
tables, data backfill, activity audit trail, RLS policies, and the compatibility
trigger. The old
`profiles` detail columns remain synchronized so deployed older clients
continue working; do not remove them until those clients have been retired.

## Publish changes

The public repository is [`Reixns/KainHUB`](https://github.com/Reixns/KainHUB)
and is already connected to Vercel. After making changes, check that no local
environment files are staged, then commit and push:

```powershell
git status --short
git add .
git status --short
git commit -m "Describe your change"
git push
```

## Deploy to Vercel

The [`kainhub` Vercel project](https://vercel.com/reianromasanta09-9537s-projects/kainhub) uses the repository root,
`npm run build`, and `dist`; [`vercel.json`](./vercel.json) also rewrites SPA
routes while directing `/api/supabase/*` to the Supabase proxy function and
excluding API paths from the SPA fallback. Production deploys automatically from
`main`; other branches receive preview deployments. The Supabase URL and
publishable browser key are configured for Production and Preview in Vercel.

In **Supabase → Authentication → URL Configuration**, keep the Site URL set to
`https://kainhub-cyan.vercel.app` and allow these redirect URLs:

```text
https://kainhub-cyan.vercel.app/**
https://kainhub-*-reianromasanta09-9537s-projects.vercel.app/**
http://localhost:5173/**
```

Do not add Supabase credentials to GitHub Actions secrets for this workflow:
the CI build does not need live credentials. Configure them in Vercel instead.
