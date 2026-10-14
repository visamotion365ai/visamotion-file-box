# VisaMOTion AI Agency — Mobile-first AI Visa Operations PWA

Company: **VisaHOBe Pte. Ltd.** · Product: **VisaMOTion AI Agency**

A mobile-first, installable PWA where the agency owner manages applicants, employers,
visa cases, documents, AI agents, PDF generation, research, approvals and client
communication. Every feature works end-to-end or clearly shows *Setup required* — no
fake dashboards, chat, PDFs or deploy status.

## Stack
- **Frontend:** single-file `index.html` (Apple Liquid Glass, Bengali default, light + dark).
- **Backend:** Vercel serverless functions in `api/` (Node 20).
- **Database + storage:** Supabase (PostgreSQL, RLS, private bucket).
- **AI providers:** Gemini → Groq → OpenRouter (server-only keys, automatic fallback).

## Screens
Home · AI Chat · AI Agents · Visa Desk · Workspace · Rejection Analysis ·
Browser-Use Agent · Website Analysis · Employer Center · PDF Studio · Tasks · Profile.

## Live integrations (truthful status shown in-app)
| Integration | Status |
|---|---|
| Supabase `Visa` project — countries, dossiers, chat | reads live when reachable |
| AI providers (Gemini/Groq/OpenRouter) | **Not configured** until keys are set as Vercel secrets |
| Website analysis | real fetch; AI summary only when a provider key exists |
| Browser-Use agent | supervised draft only — never auto-submits or pays |

## Environment variables (never commit real values)
Copy `.env.example` → set these in **Vercel → Settings → Environment Variables** as
**Secret** type (write-only after save, applies to new deployments):

```
GEMINI_API_KEY  GEMINI_API_BASE_URL  GEMINI_MODEL
GROQ_API_KEY    GROQ_API_BASE_URL    GROQ_MODEL
OPENROUTER_API_KEY  OPENROUTER_API_BASE_URL  OPENROUTER_MODEL
SUPABASE_URL  SUPABASE_ANON_KEY  SUPABASE_SERVICE_ROLE_KEY  SUPABASE_STORAGE_BUCKET
APP_BASE_URL  APP_SECRET  DEPLOY_WEBHOOK_URL
```

## Database
Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor. It creates every
table **with Row Level Security enabled** and policies that isolate by organization,
owner, client and applicant. Re-run it safely — it is idempotent.

Verify RLS is on:
```sql
select tablename, rowsecurity from pg_tables where schemaname='public';
```

## Deploy
```bash
# static + serverless, no build step
vercel --prod
```
Health check: `GET /api/health` → `{ ai_live, db_live, configured:{...} }`.

## Local check
```bash
for f in api/*.js; do node --check "$f"; done
```

## Security rules enforced
- API keys live only in server environment variables — never in the bundle, logs or GitHub.
- Every table has RLS; applicant A cannot read applicant B's profile, chat, documents,
  reference number, or browser session.
- Application reference numbers are **masked by default** and every reveal is logged.
- Approval gates block submission, payment, external messages and agreement sharing.
- The app never forges passports, visas, permits, certificates, stamps or signatures.

## Not legal advice
All assessment, rejection and reapplication content is an AI-generated operational
assessment. Verify every requirement, fee and decision against the official government
source and a licensed professional.
