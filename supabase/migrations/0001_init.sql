-- ============================================================================
-- VisaMOTion AI Agency — Supabase schema + Row Level Security
-- Run in Supabase SQL editor (or `supabase db push`). Idempotent where possible.
-- Every table has RLS ENABLED. Isolation is by organization + applicant + client.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core identity (extends Supabase auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  full_name text,
  phone text,
  role text not null default 'applicant' check (role in ('owner','staff','employer','partner','applicant','client')),
  lang text default 'bn',
  theme text default 'light',
  consent boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  owner_user uuid references auth.users(id) on delete set null,
  client_user uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  nationality text,
  consent boolean default false,
  assigned_staff uuid references auth.users(id) on delete set null,
  target_country text,
  visa_purpose text,
  case_stage text default 'intake',
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Reference data (public read)
-- ---------------------------------------------------------------------------
create table if not exists public.ff_countries (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  flag_emoji text,
  region text,
  official_source_url text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.ff_visa_purposes (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name_en text, name_bn text, name_ar text
);

create table if not exists public.ff_required_documents (
  id uuid primary key default gen_random_uuid(),
  country_code text references public.ff_countries(code) on delete cascade,
  purpose_key text,
  label_en text, label_bn text,
  sort int default 0
);

-- Public reference tables: readable by everyone, writable by owners only.
alter table public.ff_countries enable row level security;
alter table public.ff_visa_purposes enable row level security;
alter table public.ff_required_documents enable row level security;

drop policy if exists ff_countries_read on public.ff_countries;
create policy ff_countries_read on public.ff_countries for select using (true);
drop policy if exists ff_purposes_read on public.ff_visa_purposes;
create policy ff_purposes_read on public.ff_visa_purposes for select using (true);
drop policy if exists ff_docs_read on public.ff_required_documents;
create policy ff_docs_read on public.ff_required_documents for select using (true);

-- ---------------------------------------------------------------------------
-- Cases / applicants / dossiers
-- ---------------------------------------------------------------------------
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  owner_user uuid references auth.users(id) on delete cascade,
  client_user uuid references auth.users(id) on delete set null,
  full_name text not null,
  passport_masked text,
  nationality text,
  dob date,
  email text,
  phone text,
  created_at timestamptz default now()
);

create table if not exists public.visa_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  applicant_id uuid references public.applicants(id) on delete cascade,
  owner_user uuid references auth.users(id) on delete cascade,
  client_user uuid references auth.users(id) on delete set null,
  country_code text,
  purpose_key text,
  status text default 'draft',
  progress int default 0,
  created_at timestamptz default now()
);

-- Applicant-scoped tables: a user sees only their own rows; staff/owner sees org rows.
create table if not exists public.visa_dossiers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  owner_user uuid references auth.users(id) on delete cascade,
  client_user uuid references auth.users(id) on delete set null,
  applicant_name text,
  country text,
  visa_type text,
  status text default 'draft',
  progress int default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.visa_cases(id) on delete cascade,
  owner_user uuid references auth.users(id) on delete cascade default auth.uid(),
  client_user uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  engine text,
  created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.visa_cases(id) on delete cascade,
  owner_user uuid references auth.users(id) on delete cascade,
  client_user uuid references auth.users(id) on delete set null,
  kind text,
  storage_path text not null,
  label text,
  verified boolean default false,
  created_at timestamptz default now()
);

alter table public.applicants enable row level security;
alter table public.visa_cases enable row level security;
alter table public.visa_dossiers enable row level security;
alter table public.chat_messages enable row level security;
alter table public.documents enable row level security;

-- Owner/staff of the same org can see org rows; a client sees only their own.
create or replace function public.is_staff() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner','staff'));
$$;

create or replace function public.same_org(o uuid) returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.org_id = o);
$$;

-- applicants
drop policy if exists applicants_sel on public.applicants;
create policy applicants_sel on public.applicants for select using (
  owner_user = auth.uid()
  or client_user = auth.uid()
  or (public.is_staff() and public.same_org(org_id))
);
drop policy if exists applicants_ins on public.applicants;
create policy applicants_ins on public.applicants for insert with check (owner_user = auth.uid() or public.is_staff());
drop policy if exists applicants_upd on public.applicants;
create policy applicants_upd on public.applicants for update using (owner_user = auth.uid() or (public.is_staff() and public.same_org(org_id)));

-- visa_cases
drop policy if exists cases_sel on public.visa_cases;
create policy cases_sel on public.visa_cases for select using (
  owner_user = auth.uid() or client_user = auth.uid() or (public.is_staff() and public.same_org(org_id))
);
drop policy if exists cases_ins on public.visa_cases;
create policy cases_ins on public.visa_cases for insert with check (owner_user = auth.uid() or public.is_staff());
drop policy if exists cases_upd on public.visa_cases;
create policy cases_upd on public.visa_cases for update using (owner_user = auth.uid() or (public.is_staff() and public.same_org(org_id)));

-- visa_dossiers
drop policy if exists dossiers_sel on public.visa_dossiers;
create policy dossiers_sel on public.visa_dossiers for select using (
  owner_user = auth.uid() or client_user = auth.uid() or (public.is_staff() and public.same_org(org_id))
);
drop policy if exists dossiers_ins on public.visa_dossiers;
create policy dossiers_ins on public.visa_dossiers for insert with check (owner_user = auth.uid() or public.is_staff());
drop policy if exists dossiers_upd on public.visa_dossiers;
create policy dossiers_upd on public.visa_dossiers for update using (owner_user = auth.uid() or (public.is_staff() and public.same_org(org_id)));

-- chat_messages
drop policy if exists chat_sel on public.chat_messages;
create policy chat_sel on public.chat_messages for select using (
  owner_user = auth.uid() or client_user = auth.uid()
  or exists (select 1 from public.visa_cases c where c.id = case_id and (c.owner_user = auth.uid() or c.client_user = auth.uid()))
);
drop policy if exists chat_ins on public.chat_messages;
create policy chat_ins on public.chat_messages for insert with check (owner_user = auth.uid());

-- documents
drop policy if exists docs_sel on public.documents;
create policy docs_sel on public.documents for select using (
  owner_user = auth.uid() or client_user = auth.uid() or (public.is_staff() and public.same_org((select org_id from public.visa_cases c where c.id = case_id)))
);
drop policy if exists docs_ins on public.documents;
create policy docs_ins on public.documents for insert with check (owner_user = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Reference numbers — masked by default, audited reveals
-- ---------------------------------------------------------------------------
create table if not exists public.application_references (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.visa_cases(id) on delete cascade,
  owner_user uuid references auth.users(id) on delete cascade,
  client_user uuid references auth.users(id) on delete set null,
  authority text,
  ref_number text,               -- only ever set from a portal/user, never generated
  source text check (source in ('portal','user')),
  created_at timestamptz default now()
);

create table if not exists public.reference_reveals (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid references public.application_references(id) on delete cascade,
  revealed_by uuid references auth.users(id) on delete set null,
  revealed_at timestamptz default now()
);

alter table public.application_references enable row level security;
alter table public.reference_reveals enable row level security;

drop policy if exists refs_sel on public.application_references;
create policy refs_sel on public.application_references for select using (owner_user = auth.uid() or client_user = auth.uid());
drop policy if exists refs_ins on public.application_references;
create policy refs_ins on public.application_references for insert with check (owner_user = auth.uid() and source is not null);
drop policy if exists reveals_sel on public.reference_reveals;
create policy reveals_sel on public.reference_reveals for select using (revealed_by = auth.uid());
drop policy if exists reveals_ins on public.reference_reveals;
create policy reveals_ins on public.reference_reveals for insert with check (revealed_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Approvals + audit
-- ---------------------------------------------------------------------------
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.visa_cases(id) on delete cascade,
  action text not null,
  payload jsonb,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  decided_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz default now()
);

alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists approvals_sel on public.approvals;
create policy approvals_sel on public.approvals for select using (
  requested_by = auth.uid() or approved_by = auth.uid() or public.is_staff()
);
drop policy if exists approvals_ins on public.approvals;
create policy approvals_ins on public.approvals for insert with check (requested_by = auth.uid() or public.is_staff());
drop policy if exists approvals_upd on public.approvals;
create policy approvals_upd on public.approvals for update using (approved_by = auth.uid() or public.is_staff());

drop policy if exists audit_sel on public.audit_logs;
create policy audit_sel on public.audit_logs for select using (public.is_staff());
drop policy if exists audit_ins on public.audit_logs;
create policy audit_ins on public.audit_logs for insert with check (true);

-- ---------------------------------------------------------------------------
-- Private storage bucket + object policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('visa-documents','visa-documents', false)
on conflict (id) do nothing;

drop policy if exists store_read on storage.objects;
create policy store_read on storage.objects for select using (
  bucket_id = 'visa-documents' and (owner = auth.uid() or public.is_staff())
);
drop policy if exists store_write on storage.objects;
create policy store_write on storage.objects for insert with check (
  bucket_id = 'visa-documents' and (owner = auth.uid() or public.is_staff())
);

-- ---------------------------------------------------------------------------
-- Seed reference countries (safe, public data only)
-- ---------------------------------------------------------------------------
insert into public.ff_countries (code,name,flag_emoji,region,official_source_url) values
 ('AU','Australia','🇦🇺','Oceania','https://immi.homeaffairs.gov.au/'),
 ('RS','Serbia','🇷🇸','Europe','https://www.mfa.gov.rs/en/'),
 ('TR','Turkey','🇹🇷','Asia','https://www.evisa.gov.tr/'),
 ('SG','Singapore','🇸🇬','Asia','https://www.ica.gov.sg/'),
 ('MY','Malaysia','🇲🇾','Asia','https://malaysiavisa.imi.gov.my/'),
 ('BH','Bahrain','🇧🇭','Asia','https://www.evisa.gov.bh/'),
 ('JP','Japan','🇯🇵','Asia','https://www.mofa.go.jp/j_info/visit/visa/'),
 ('AE','United Arab Emirates','🇦🇪','Asia','https://u.ae/en/information-and-services/visa-and-emirates-id'),
 ('KR','South Korea','🇰🇷','Asia','https://www.immigration.go.kr/immigration_eng/index.do'),
 ('DE','Germany','🇩🇪','Europe','https://www.auswaertiges-amt.de/en/visa-service'),
 ('GB','United Kingdom','🇬🇧','Europe','https://www.gov.uk/browse/visas-immigration'),
 ('US','United States','🇺🇸','Americas','https://travel.state.gov/content/travel/en/us-visas.html')
on conflict (code) do nothing;
