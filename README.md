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
routes. Production deploys automatically from `main`; other branches receive
preview deployments. The Supabase URL and publishable browser key are configured
for Production and Preview in Vercel.

In **Supabase → Authentication → URL Configuration**, keep the Site URL set to
`https://kainhub-cyan.vercel.app` and allow these redirect URLs:

```text
https://kainhub-cyan.vercel.app/**
https://kainhub-*-reianromasanta09-9537s-projects.vercel.app/**
http://localhost:5173/**
```

Do not add Supabase credentials to GitHub Actions secrets for this workflow:
the CI build does not need live credentials. Configure them in Vercel instead.
