# 4. GitHub & Vercel Deployment Guide

## 4.1 Repository hygiene

- `.gitignore` (root) excludes `node_modules`, `.next`, `dist`, `.vercel`, **all `.env*` except `.env.example`**, local DB/upload folders, Expo native folders and signing keys.
- Secrets live only in Vercel / EAS settings. Search before every push:
  ```bash
  git grep -nE "AIza[0-9A-Za-z_-]{35}|postgres(ql)?://[^ ]+:[^ ]+@|sk_live|BEGIN (RSA|PRIVATE)" || echo clean
  ```
- If a secret is ever committed: **rotate it**, then clean history. Deleting the file is not enough.

## 4.2 Environment variables

Defined in `.env.example`. Add each in **Vercel → Project → Settings → Environment Variables**:

| Variable | Production | Preview | Development | Notes |
|---|:-:|:-:|:-:|---|
| `DATABASE_URL` | ✔ | ✔ | ✔ | Pooled URL. **Use a separate DB (or Neon branch) for Preview** |
| `DIRECT_URL` | ✔ | ✔ | ✔ | Direct URL, used by `prisma migrate` |
| `JWT_ACCESS_SECRET` | ✔ | ✔ | ✔ | `openssl rand -base64 48`; different per environment. Mark **Sensitive** |
| `APP_URL` | ✔ | – | – | `https://your-domain.com` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ✔ | ✔ | ✔ | Public by design → restrict (below) |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | ✔ | ✔ | ✔ | Create a Map ID in Google Cloud (Advanced Markers) |
| `BLOB_READ_WRITE_TOKEN` | ✔ | ✔ | ✔ | Created by Storage → Blob → connect to project |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ✔ | ✔ | opt. | Storage → Upstash Redis (Marketplace) |

`NEXT_PUBLIC_*` values are baked in at **build time** — redeploy after changing them. Never put the JWT secret, DB URL or Blob token in a `NEXT_PUBLIC_*` variable.

Google Cloud → Credentials: enable **Maps JavaScript API** + **Geocoding API**; restrict the web key by **HTTP referrers** (`https://your-domain.com/*`, `https://*.vercel.app/*` for previews) and by API. Make separate Android/iOS keys restricted by package name / bundle ID. Set a budget alert.

## 4.3 `vercel.json` (apps/web/vercel.json)

Included and annotated here:
- `framework: nextjs` and `buildCommand: npm run vercel-build` → `prisma generate` → **migrate only when `VERCEL_ENV=production`** → `next build`. Previews never touch the production DB.
- `functions` → 20 s max duration for API handlers.
- `headers` → HSTS, nosniff, frame deny, referrer + permissions policy; `no-store` on `/api/*`; immutable cache on `/_next/static/*`; **CSP in `Report-Only`** (see below).
- **No `env` / `build.env` keys** (legacy anti-pattern that leaks values into config); no rewrites are needed because Next.js owns routing, so there is **no SPA fallback**. Only if you later host a static Expo-web export separately, add to *that* project:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

**CSP rollout:** deploy once, open the app (landing, map, chat), check the browser console for `Content-Security-Policy-Report-Only` violations, add any missing hosts, then rename the header key to `Content-Security-Policy`. It currently allows inline scripts/styles because Next.js injects them; moving to nonces is a later hardening step.

## 4.4 Git: init, commit, push

```bash
cd internlink
git init -b main
git add .
git status                     # confirm NO .env files and no node_modules are listed
git commit -m "feat: initial InternLink platform"
# create an EMPTY repo on github.com (no README), then:
git remote add origin https://github.com/<you>/internlink.git
git push -u origin main
```
Later: `git checkout -b feature/x` → push → open PR → Vercel builds a **Preview** for the branch.

## 4.5 Connect to Vercel

1. **vercel.com → Add New → Project → Import** your GitHub repo.
2. **Root Directory:** `apps/web` (this is a monorepo). Keep *"Include source files outside of the Root Directory in the Build Step"* **enabled** — the build needs `packages/shared`.
3. Framework preset: Next.js (auto). Leave Install Command default (Vercel detects npm workspaces and installs from the repo root). Build Command comes from `vercel.json`.
4. Node.js version: 20.x or 22.x (Settings → General).
5. Add the environment variables (4.2) for the right environments **before** the first deploy.
6. Create the database first (Neon/Supabase/Vercel Postgres) and run migrations once from your machine so the first Production build has a schema:
   ```bash
   cd apps/web && DATABASE_URL="…" DIRECT_URL="…" npx prisma migrate deploy
   ```
   After that, every Production deploy runs `migrate deploy` automatically (it is a no-op when nothing is pending).
7. Click **Deploy**. Add your custom domain under Settings → Domains and set `APP_URL`.

## 4.6 Mobile ↔ deployed backend

| Where | `EXPO_PUBLIC_API_URL` |
|---|---|
| Local simulator/device | `http://<your-computer-LAN-IP>:3000` (not `localhost` on a physical phone; Android emulator: `http://10.0.2.2:3000`) |
| Preview/staging build | the Preview deployment URL (disable Vercel Deployment Protection for API, or use a stable staging domain) |
| Production build | `https://your-domain.com` |

- iOS blocks plain `http://` in release builds — production must be HTTPS (Vercel is).
- Set the env in `apps/mobile/.env` locally, and as **EAS Secrets / eas.json env** for cloud builds. Map keys: `GOOGLE_MAPS_ANDROID_API_KEY`, `GOOGLE_MAPS_IOS_API_KEY`.
- Build: `npx expo run:android` (local) or `eas build -p android|ios`. Expo Go cannot run react-native-maps (Google) or expo-speech-recognition.

## 4.7 Post-deploy verification checklist

**Build & config**
- [ ] Vercel build log shows `prisma generate`, then `[build] Production build → applying database migrations`, then a successful `next build`.
- [ ] Settings → Environment Variables: every variable present in the correct environment; none are `NEXT_PUBLIC_` secrets.
- [ ] `curl -sI https://your-domain.com | grep -iE "strict-transport|x-frame|content-security"` shows the headers.

**Auth & RBAC**
- [ ] Register a student and a company; sign in/out on web; cookies are `HttpOnly; Secure`.
- [ ] Visiting `/company` as a student redirects to `/student` (and vice-versa); `POST /api/vacancies` as a student → 403.
- [ ] 6 wrong passwords → "Too many failed attempts"; rate-limit 429 appears with `Retry-After` (needs Upstash configured).
- [ ] Mobile: sign in against the production URL; kill and reopen the app → still signed in (refresh works).

**Google Maps**
- [ ] Map renders (no "for development purposes only" watermark ⇒ billing + key OK); *Use my location* prompts; deny → message + place search + tap-to-pin work; markers show the preview.
- [ ] Console has no `RefererNotAllowedMapError` (fix referrer restriction if it does).

**Messaging & voice**
- [ ] Two browsers (student + HR): message appears within ~3 s; ticks go Sent → Delivered → Read.
- [ ] Mic button asks for permission, shows live text, finished text lands in the editable box (Chrome/Edge/Safari; hidden in Firefox).

**Uploads**
- [ ] Upload PDF ok; a `.exe` renamed to `.pdf` is rejected; a 5 MB file is rejected; student cannot read another student's document URL (`/api/documents/<id>` → 404).

**Locked evaluation (most important)**
- [ ] HR marks application *Completed* → student sends form → HR submits (confirm dialog shown).
- [ ] Student view shows 🔒 read-only with seal hash and "Integrity verified"; no inputs on the page.
- [ ] Student `PATCH /api/evaluations/<appId>` with scores → 400/409; HR second submit → 409 `EVALUATION_LOCKED`.
- [ ] `psql "$DIRECT_URL" -c "UPDATE \"Evaluation\" SET remarks='x' WHERE status='SUBMITTED'"` → `ERROR: EVALUATION_LOCKED` (run against a **test** DB).
- [ ] `AuditLog` has `evaluation.request` and `evaluation.submit` rows.

## 4.8 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Cannot find module '@internlink/shared'` | Root Directory set to `apps/web` but "include files outside root" disabled → enable it; ensure install runs at repo root |
| `@prisma/client did not initialize yet` | `prisma generate` didn't run → build command must be `npm run vercel-build` (already in `vercel.json`); `postinstall` also runs it |
| `P1001 can't reach database` during build | `DIRECT_URL` missing/blocked for the Production env, or DB paused (Neon) → wake/allow; use the **direct** URL for migrations |
| Prisma on serverless: "too many connections" | Use the **pooled** `DATABASE_URL` (Neon `-pooler` host / Supabase pooler port 6543 with `?pgbouncer=true&connection_limit=1`) |
| `JWT_ACCESS_SECRET must be set…` | Missing in that environment (Preview vs Production) |
| Map is grey / `ApiNotActivatedMapError` | Enable Maps JavaScript API; add referrers; redeploy after changing `NEXT_PUBLIC_*` |
| Login works but every API call 401 on web | Cookies blocked by `Secure` on plain http (use `localhost`, which is exempt) or mismatched domain |
| 403 `CSRF` on POST from the web app | Request came from a different origin/host (e.g. a proxy rewriting `Host`) → call same-origin only |
| Upload fails with 413 | Vercel caps function bodies ~4.5 MB; keep files ≤ 4 MB or implement Blob client uploads |
| Mobile "Network request failed" | Used `localhost` on a device; wrong LAN IP; http in an iOS release build; Preview Deployment Protection blocking the API |
| Chat feels slow | Polling is 3 s by design; switch to Ably/Pusher/Supabase Realtime for push |
| Preview deployments hit the production DB | Don't — give Preview its own `DATABASE_URL` (Neon branching is ideal) |
| Migration needed after schema edits | `cd apps/web && npx prisma migrate dev --name <change>` locally, commit `prisma/migrations/*`, push; Production build applies it |
