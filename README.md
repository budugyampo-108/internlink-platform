# InternLink — Student-to-Industry Internship & Attachment Platform

Web app + API (Next.js on Vercel), mobile app (Expo, iOS/Android), shared validation package, Postgres.

```
internlink/
├─ apps/
│  ├─ web/            Next.js 15 (App Router): UI + REST API route handlers + Prisma + vercel.json
│  └─ mobile/         Expo (React Native) — talks to the deployed web API with Bearer tokens
├─ packages/shared/   zod schemas, enums, status state-machine (single source of truth)
├─ docs/              01 Architecture · 02 Database & Security · 03 UX spec · 04 Deployment
├─ .env.example       every variable, documented
└─ .gitignore
```

## Quick start (local)

```bash
npm install                                  # installs all workspaces; runs `prisma generate`
cp .env.example apps/web/.env                # fill DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET (+ Maps key)
npm run db:migrate:deploy                    # applies 0001_init + 0002_integrity_locks
npm run db:seed                              # demo: student@demo.test / hr@demo.test  (Demo12345!)
npm run dev                                  # http://localhost:3000
```

Mobile (needs a development build — maps + speech recognition are not in Expo Go):

```bash
cd apps/mobile
cp ../../.env.example .env                   # set EXPO_PUBLIC_API_URL to http://<LAN-IP>:3000
npm install
npx expo install react react-native react-native-screens react-native-safe-area-context   # aligns versions to the SDK
npx expo install --fix
npx expo run:android                         # or: npx expo run:ios
```

## Read next
1. [docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md) — stack and why
2. [docs/02-DATABASE-AND-SECURITY.md](docs/02-DATABASE-AND-SECURITY.md) — schema, RBAC matrix, **evaluation lock**
3. [docs/03-UX-SPEC.md](docs/03-UX-SPEC.md) — flows, HCI, 3D hero, Maps + voice UX
4. [docs/04-DEPLOYMENT.md](docs/04-DEPLOYMENT.md) — GitHub → Vercel, env vars, checklist, troubleshooting

## Scope of this starter (be aware)
- **Built:** auth + RBAC, company/department/vacancy APIs, proximity search, applications, per-application chat with voice dictation, locked evaluation (UI + API + DB), uploads, audit log, 3D landing, Google Maps explorer, mobile login/discover/applications/chat.
- **API only (no UI yet):** company onboarding forms (profile, departments, vacancies), student profile editing. Endpoints exist (`PUT /api/company`, `POST /api/departments`, `POST /api/vacancies`); build forms per docs/03.
- **Mobile limits:** apply-with-documents and HR evaluation submission are web-only; mobile shows the evaluation read-only.
- **Chat is polling (3 s)**, because Vercel functions cannot hold WebSockets. Swap in Ably/Pusher/Supabase Realtime when you need push.
- **Uploads use public Vercel Blob URLs** (unguessable, and downloads go through an authorised redirect). For stricter confidentiality use private storage / signed URLs.
