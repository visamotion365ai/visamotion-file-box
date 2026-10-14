# VisaMOTion File Box — Admin OS (Step 3)

Single-file Apple **Liquid Glass** iOS app with 5 interactive screens matching the VisaMotion File Box reference, plus live Supabase, real batch-ZIP export and PWA.

## Screens
1. **Home Explore** — Hello VisaMotion, Visa File Box (28.4/100 GB) + Google Drive (42.7/100 GB) glass cards with live Clean, 2x2 Categories
2. **Visa File Box** — Home – Visa File Box hero, Visa Folders (Work/Visitor/Student/Business), module tabs
3. **AI Visa Hub** — Need help filing visas today?, Passport/Camera/Voice, Unlock Pro, 3 solvers, Today's Tasks
4. **AI Agent Chat** — animated robot orb, live chat, country + engine chips, composer
5. **Profile & Cloud** — Imran Hossen Level 5, 187h saved, 670 visas, metrics, PWA & Cloud Sync, filing history

## Live integrations
- **Supabase** project `Visa` (ref bnexivtxepdknmkinmpj) — `visa_dossiers`, `applicant_profiles`, `chat_messages`, RLS on; app reads dossiers live.
- **Batch .ZIP** — pure-JS PKZIP (store + CRC32) built in-browser, no dependencies.
- **PDF Studio** — A4 preview/zoom + real single-page PDF export.
- **PWA** — installable, offline-capable.

## Deploy (static, no build step)
Vercel / Netlify / AWS S3+CloudFront — serve `index.html` from the root.

Live: https://visamotion-filebox.pages.bu.app/
Repo: https://github.com/visamotion365ai/visamotion-file-box
