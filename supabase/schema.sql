-- =====================================================================
-- CV Pro — Supabase schema (run once in Supabase → SQL Editor)
-- Security model:
--   * Users can read/write ONLY their own CVs.
--   * Users can READ their own orders but can NEVER create or change one.
--     Orders are written only by the server (service role) after a
--     verified payment webhook, or by an admin approving a CliQ transfer.
--   * Generated files live in a PRIVATE bucket; only the server issues
--     short-lived signed URLs.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- users may NOT promote themselves
create or replace function public.protect_role() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role and current_user not in ('postgres','supabase_admin','service_role') and not public.is_admin() then
    raise exception 'role change not allowed';
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- ---------- packages (prices are data, not code) ----------
create table if not exists public.packages (
  code text primary key,                       -- basic | pro | premium
  name_ar text not null, name_en text not null,
  price_usd_cents int not null,
  price_jod_fils int not null,                 -- for CliQ (1 JOD = 1000 fils)
  formats text[] not null,                     -- {'pdf'} or {'pdf','docx'}
  edit_days int not null,                      -- free edits/regeneration window
  ai_enabled boolean not null default false,
  ls_variant_id text,                          -- Lemon Squeezy variant id
  sort int not null default 0,
  active boolean not null default true
);

insert into public.packages (code,name_ar,name_en,price_usd_cents,price_jod_fils,formats,edit_days,ai_enabled,sort) values
 ('basic',  'أساسي',   'Basic',   500,  3000, '{pdf}',      7,  false, 1),
 ('pro',    'احترافي', 'Pro',     900,  6000, '{pdf,docx}', 30, false, 2),
 ('premium','مميّز',   'Premium', 1900, 12000,'{pdf,docx}', 90, true,  3)
on conflict (code) do nothing;

-- ---------- cvs ----------
create table if not exists public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'سيرتي الذاتية',
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cvs_user_idx on public.cvs(user_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists cvs_touch on public.cvs;
create trigger cvs_touch before update on public.cvs for each row execute function public.touch_updated_at();

-- ---------- orders (server-written only) ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid not null references public.cvs(id) on delete cascade,
  package_code text not null references public.packages(code),
  provider text not null check (provider in ('lemonsqueezy','cliq','manual','paypal')),
  provider_order_id text not null,
  status text not null check (status in ('paid','refunded')),
  amount_cents int not null,
  currency text not null,
  paid_at timestamptz not null default now(),
  unlock_until timestamptz not null,
  locked_name text,              -- set on first generation; prevents reusing one payment for another person
  gen_count int not null default 0,
  ai_calls int not null default 0,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_order_id)        -- idempotent webhooks
);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_cv_idx on public.orders(cv_id);

-- ---------- CliQ / bank transfer requests (manual approval) ----------
create table if not exists public.manual_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid not null references public.cvs(id) on delete cascade,
  package_code text not null references public.packages(code),
  reference text not null,           -- CliQ transaction reference
  payer_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
-- one CliQ reference can be claimed only once
create unique index if not exists manual_payments_reference_uniq on public.manual_payments (lower(reference));

-- ---------- downloads log ----------
create table if not exists public.downloads (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid not null references public.cvs(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  format text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.packages        enable row level security;
alter table public.cvs             enable row level security;
alter table public.orders          enable row level security;
alter table public.manual_payments enable row level security;
alter table public.downloads       enable row level security;

drop policy if exists "profile self read"   on public.profiles;
drop policy if exists "profile self update" on public.profiles;
create policy "profile self read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profile self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "packages public read" on public.packages;
drop policy if exists "packages admin write" on public.packages;
create policy "packages public read" on public.packages for select using (true);
create policy "packages admin write" on public.packages for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cvs owner all" on public.cvs;
create policy "cvs owner all" on public.cvs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders: read only. NO insert/update/delete policy for users => denied.
drop policy if exists "orders owner read" on public.orders;
create policy "orders owner read" on public.orders for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "manual owner insert" on public.manual_payments;
drop policy if exists "manual owner read"   on public.manual_payments;
create policy "manual owner insert" on public.manual_payments for insert
  with check (user_id = auth.uid() and status = 'pending'
              and exists (select 1 from public.cvs c where c.id = cv_id and c.user_id = auth.uid()));
create policy "manual owner read" on public.manual_payments for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "downloads owner read" on public.downloads;
create policy "downloads owner read" on public.downloads for select using (user_id = auth.uid() or public.is_admin());

-- =====================================================================
-- Admin actions (security definer, checked inside)
-- =====================================================================
create or replace function public.admin_review_manual(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m public.manual_payments; pk public.packages;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select * into m from public.manual_payments where id = p_id for update;
  if m.id is null or m.status <> 'pending' then raise exception 'not pending'; end if;
  update public.manual_payments set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_at = now(), reviewed_by = auth.uid() where id = p_id;
  if p_approve then
    select * into pk from public.packages where code = m.package_code;
    insert into public.orders (user_id, cv_id, package_code, provider, provider_order_id, status, amount_cents, currency, unlock_until)
    values (m.user_id, m.cv_id, m.package_code, 'cliq', m.reference, 'paid', pk.price_jod_fils / 10, 'JOD', now() + make_interval(days => pk.edit_days))
    on conflict (provider, provider_order_id) do nothing;
  end if;
end $$;

create or replace function public.admin_revenue()
returns table (day date, provider text, currency text, orders bigint, total_cents bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc('day', paid_at)::date, provider, currency, count(*), sum(amount_cents)
  from public.orders where status = 'paid' and public.is_admin()
  group by 1,2,3 order by 1 desc limit 120;
$$;

-- Lock down who may call the security-definer functions through the API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.admin_review_manual(uuid, boolean) from public, anon;
revoke execute on function public.admin_revenue() from public, anon;
grant execute on function public.admin_review_manual(uuid, boolean) to authenticated;
grant execute on function public.admin_revenue() to authenticated;

-- =====================================================================
-- Storage: private bucket for generated files (no client policies => server only)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('exports', 'exports', false)
on conflict (id) do nothing;

-- After your first sign-up, make yourself admin:
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR@EMAIL');
