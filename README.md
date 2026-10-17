# KainHUB

Marketplace app built with React, Vite, and Supabase.

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

## Publish to GitHub

1. Create an empty **public** repository named `Reixns/KainHUB` on GitHub.
   Do not add a README, `.gitignore`, or license during repository creation.
2. Install Git for Windows if `git --version` is not available. From this
   project folder, initialize Git if needed, commit the project, and push the
   `main` branch:

   ```powershell
   git init -b main
   git add .
   git status --short
   git commit -m "Prepare KainHUB for deployment"
   git remote add origin https://github.com/Reixns/KainHUB.git
   git push -u origin main
   ```

   Before committing, confirm `.env` is not listed by `git status --short`.
   If this folder already has an `origin`, update it with
   `git remote set-url origin https://github.com/Reixns/KainHUB.git` instead.
3. GitHub Actions automatically runs `npm ci`, lint, type-check, and production
   build for pushes to `main`/`master` and pull requests.

## Deploy to Vercel

1. Import the GitHub repository in Vercel and select the Vite project.
2. Keep the project root at the repository root. The checked-in
   [`vercel.json`](./vercel.json) configures `npm run build`, `dist`, and SPA
   route rewrites.
3. In **Project Settings → Environment Variables**, add these for Production,
   Preview, and Development as needed:
   - `VITE_SUPABASE_URL` — the Supabase project URL, e.g.
     `https://your-project-ref.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — the Supabase anon/publishable browser key
4. Redeploy after changing environment variables. Vercel will build and deploy
   each push to the connected production branch; other branches/PRs get preview
   deployments.
5. In **Supabase → Authentication → URL Configuration**, set the production
   Vercel URL as the Site URL and add the production and preview app URLs to
   Redirect URLs. Also add `http://localhost:5173/**` for local testing. Add a
   custom domain URL there too if you use one.

Do not add Supabase credentials to GitHub Actions secrets for this workflow:
the CI build does not need live credentials. Configure them in Vercel instead.
