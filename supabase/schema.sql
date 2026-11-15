-- ============================================================================
--  Naujan Lake Eco-Tourism & Wildlife Information Management System
--  Requirement E — relational schema for Supabase (PostgreSQL 15+)
--
--  Seven tables:
--    users · categories · species · tours · tour_inquiries · advisories
--    · subscribers
--
--  Run this file in the Supabase SQL editor on a fresh project, or with
--    psql "$DATABASE_URL" -f supabase/schema.sql
--  The script is idempotent: enums and policies are guarded, tables use
--  IF NOT EXISTS, and seed rows use ON CONFLICT DO NOTHING.
--
--  Passwords: `users.password_hash` stores the salted SHA-256 digest
--  sha256(lower(email) || ':' || password) used by the Next.js demo auth
--  layer (lib/auth.ts). When Supabase Auth is switched on, the digest moves
--  to auth.users.encrypted_password and this column is left unused.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Enumerated types
-- ---------------------------------------------------------------------------
do $$ begin create type public.user_role as enum ('admin', 'visitor'); exception when duplicate_object then null; end $$;
do $$ begin create type public.conservation_status as enum ('CR', 'EN', 'VU', 'NT', 'LC', 'DD'); exception when duplicate_object then null; end $$;
do $$ begin create type public.seasonality as enum ('RESIDENT', 'MIGRATORY', 'SEASONAL'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tour_difficulty as enum ('EASY', 'MODERATE', 'CHALLENGING'); exception when duplicate_object then null; end $$;
do $$ begin create type public.inquiry_status as enum ('PENDING', 'ON_PROCESS', 'CONTACTED', 'CONFIRMED', 'COMPLETED', 'DECLINED', 'CANCELLED'); exception when duplicate_object then null; end $$;
-- Existing databases pick up the new workflow states without a rebuild.
do $$ begin alter type public.inquiry_status add value if not exists 'ON_PROCESS'; exception when duplicate_object then null; end $$;
do $$ begin alter type public.inquiry_status add value if not exists 'COMPLETED'; exception when duplicate_object then null; end $$;
do $$ begin alter type public.inquiry_status add value if not exists 'CANCELLED'; exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('GCASH', 'MAYA', 'BANK_TRANSFER', 'ON_SITE_CASH'); exception when duplicate_object then null; end $$;
do $$ begin alter type public.payment_method add value if not exists 'ON_SITE_CASH'; exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('UNPAID', 'PENDING_VERIFICATION', 'VERIFIED', 'REFUNDED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.advisory_severity as enum ('CRITICAL', 'WARNING', 'INFO'); exception when duplicate_object then null; end $$;
do $$ begin create type public.subscriber_status as enum ('ACTIVE', 'UNSUBSCRIBED'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- 2.1 users — visitors and park staff (Requirement G: two roles)
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  full_name     text not null,
  phone         text,
  role          public.user_role not null default 'visitor',
  password_hash text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz,
  constraint users_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'),
  constraint users_full_name_length
    check (char_length(full_name) between 2 and 120)
);

comment on table  public.users is 'Visitor and staff accounts. Self-registration always writes role = visitor.';
comment on column public.users.password_hash is 'Salted SHA-256 digest sha256(email:password); replaced by auth.users.encrypted_password under Supabase Auth.';

-- 2.2 categories — wildlife taxonomy groups (FR-1.1)
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 2.3 species — biodiversity catalogue (FR-1.2)
create table if not exists public.species (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references public.categories (id) on delete restrict,
  common_name         text not null,
  local_name          text,
  scientific_name     text not null,
  conservation_status public.conservation_status not null,
  seasonality         public.seasonality not null,
  habitat             text not null,
  description         text not null,
  featured_image      text not null,
  slug                text not null unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 2.4 tours — eco-tourism packages (FR-2.1, FR-2.2)
create table if not exists public.tours (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  slug            text not null unique,
  category        text not null,
  summary         text not null,
  duration        text not null,
  departure       text not null,
  rate_per_person numeric(10, 2) not null check (rate_per_person >= 0),
  max_capacity    integer not null check (max_capacity between 1 and 60),
  difficulty      public.tour_difficulty not null,
  inclusions      text[] not null default '{}',
  what_to_bring   text[] not null default '{}',
  notes           text[] not null default '{}',
  species_slugs   text[] not null default '{}',
  itinerary       jsonb not null default '[]'::jsonb,
  tariff          jsonb not null default '[]'::jsonb,
  featured_image  text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.tours.itinerary is 'Ordered stops: [{"time":"05:30","title":"…","detail":"…"}].';
comment on column public.tours.tariff    is 'Price lines: [{"label":"Boat rental","amount":700}]. Sum equals rate_per_person.';
comment on column public.tours.species_slugs is 'FR-1.3: species slugs (public.species.slug) this package is built around.';

-- Projects created before FR-1.3 need the new column added in place; the
-- create table above only covers a fresh database.
alter table public.tours
  add column if not exists species_slugs text[] not null default '{}';

-- 2.5 tour_inquiries — booking requests & first payment tracking (FR-2.3)
create table if not exists public.tour_inquiries (
  id                   uuid primary key default gen_random_uuid(),
  reference_code       text not null unique,
  tour_id              uuid not null references public.tours (id) on delete restrict,
  user_id              uuid references public.users (id) on delete set null,
  full_name            text not null,
  email                text not null,
  phone                text,
  target_date          date not null,
  party_size           integer not null check (party_size between 1 and 60),
  notes                text,
  status               public.inquiry_status not null default 'PENDING',
  on_process_at        timestamptz,
  confirmed_at         timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  decided_by           text check (decided_by in ('visitor', 'park')),
  rate_per_person      numeric(10, 2) not null default 0,
  total_amount         numeric(10, 2) not null default 0,
  first_payment_amount numeric(10, 2) not null default 0,
  balance_amount       numeric(10, 2) not null default 0,
  payment_method       public.payment_method,
  payment_reference    text,
  payment_account_name text,
  payment_status       public.payment_status not null default 'UNPAID',
  payment_submitted_at timestamptz,
  payment_verified_at  timestamptz,
  admin_note           text,
  timeline             jsonb not null default '[]'::jsonb,
  messages             jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint tour_inquiries_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$')
);

alter table public.tour_inquiries
  add column if not exists on_process_at        timestamptz,
  add column if not exists completed_at         timestamptz,
  add column if not exists rate_per_person      numeric(10, 2) not null default 0,
  add column if not exists total_amount         numeric(10, 2) not null default 0,
  add column if not exists first_payment_amount numeric(10, 2) not null default 0,
  add column if not exists balance_amount       numeric(10, 2) not null default 0,
  add column if not exists payment_method       public.payment_method,
  add column if not exists payment_reference    text,
  add column if not exists payment_account_name text,
  add column if not exists payment_status       public.payment_status not null default 'UNPAID',
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists payment_verified_at  timestamptz,
  add column if not exists admin_note           text,
  add column if not exists timeline             jsonb not null default '[]'::jsonb,
  add column if not exists messages             jsonb not null default '[]'::jsonb;

-- 2.6 advisories — park announcements (Module 4)
create table if not exists public.advisories (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references public.users (id) on delete set null,
  title           text not null,
  slug            text not null unique,
  severity        public.advisory_severity not null,
  category        text not null default 'Operations',
  excerpt         text not null,
  content         text not null,
  effective_until date,
  actions         text[] not null default '{}',
  is_active_banner boolean not null default false,
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Projects created before the advisory CMS columns need them added in place;
-- the create table above only covers a fresh database.
alter table public.advisories
  add column if not exists category        text not null default 'Operations',
  add column if not exists effective_until date,
  add column if not exists actions         text[] not null default '{}',
  add column if not exists updated_at      timestamptz not null default now();

-- The form posts one of four fixed categories; keep the column honest without
-- introducing an enum that would need a migration to extend.
do $$ begin
  alter table public.advisories
    add constraint advisories_category_check
    check (category in ('Wildlife', 'Water', 'Access', 'Operations'));
exception when duplicate_object then null; end $$;

comment on column public.advisories.category is 'CMS grouping: Wildlife, Water, Access or Operations.';
comment on column public.advisories.effective_until is 'Last day the notice applies; NULL means open-ended.';
comment on column public.advisories.actions is 'Concrete instructions shown as a checklist on the detail page.';

-- 2.7 subscribers — newsletter audience (Module 6)
create table if not exists public.subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  status        public.subscriber_status not null default 'ACTIVE',
  topics        text[] not null default '{advisories}',
  subscribed_at timestamptz not null default now(),
  constraint subscribers_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$')
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
create index if not exists species_category_idx        on public.species (category_id);
create index if not exists species_status_idx          on public.species (conservation_status);
create index if not exists species_seasonality_idx     on public.species (seasonality);
create index if not exists tours_active_idx            on public.tours (is_active, title);
create index if not exists tours_species_slugs_idx     on public.tours using gin (species_slugs);
create index if not exists inquiries_tour_idx          on public.tour_inquiries (tour_id);
create index if not exists inquiries_user_idx          on public.tour_inquiries (user_id);
create index if not exists inquiries_status_idx        on public.tour_inquiries (status);
create index if not exists inquiries_created_idx       on public.tour_inquiries (created_at desc);
create index if not exists inquiries_target_date_idx   on public.tour_inquiries (target_date);
create index if not exists advisories_published_idx    on public.advisories (published_at desc);
create index if not exists advisories_severity_idx     on public.advisories (severity);
create index if not exists advisories_category_idx     on public.advisories (category);
create index if not exists users_role_idx              on public.users (role);
create index if not exists subscribers_status_idx      on public.subscribers (status);

-- ---------------------------------------------------------------------------
-- 4. updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists species_touch_updated_at on public.species;
create trigger species_touch_updated_at
  before update on public.species
  for each row execute function public.touch_updated_at();

drop trigger if exists tours_touch_updated_at on public.tours;
create trigger tours_touch_updated_at
  before update on public.tours
  for each row execute function public.touch_updated_at();

drop trigger if exists inquiries_touch_updated_at on public.tour_inquiries;
create trigger inquiries_touch_updated_at
  before update on public.tour_inquiries
  for each row execute function public.touch_updated_at();

drop trigger if exists advisories_touch_updated_at on public.advisories;
create trigger advisories_touch_updated_at
  before update on public.advisories
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row-Level Security
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.is_active
  );
$$;

alter table public.users          enable row level security;
alter table public.categories     enable row level security;
alter table public.species        enable row level security;
alter table public.tours          enable row level security;
alter table public.tour_inquiries enable row level security;
alter table public.advisories     enable row level security;
alter table public.subscribers    enable row level security;

-- users: read your own row, edit your own profile, staff see everyone
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users
  for all using (public.is_admin()) with check (public.is_admin());

-- published content is world-readable; only staff may change it
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists species_public_read on public.species;
create policy species_public_read on public.species for select using (true);

drop policy if exists species_admin_write on public.species;
create policy species_admin_write on public.species
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists tours_public_read on public.tours;
create policy tours_public_read on public.tours for select using (is_active or public.is_admin());

drop policy if exists tours_admin_write on public.tours;
create policy tours_admin_write on public.tours
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists advisories_public_read on public.advisories;
create policy advisories_public_read on public.advisories
  for select using (published_at <= now() or public.is_admin());

drop policy if exists advisories_admin_write on public.advisories;
create policy advisories_admin_write on public.advisories
  for all using (public.is_admin()) with check (public.is_admin());

-- inquiries: visitors file their own, staff triage everything
drop policy if exists inquiries_insert on public.tour_inquiries;
create policy inquiries_insert on public.tour_inquiries
  for insert with check (true);

drop policy if exists inquiries_select_own on public.tour_inquiries;
create policy inquiries_select_own on public.tour_inquiries
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists inquiries_admin_update on public.tour_inquiries;
create policy inquiries_admin_update on public.tour_inquiries
  for update using (
    public.is_admin()
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    public.is_admin()
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists inquiries_delete_own on public.tour_inquiries;
create policy inquiries_delete_own on public.tour_inquiries
  for delete using (
    public.is_admin()
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- newsletter: anyone may subscribe, only staff may read the audience
drop policy if exists subscribers_insert on public.subscribers;
create policy subscribers_insert on public.subscribers for insert with check (true);

drop policy if exists subscribers_admin_read on public.subscribers;
create policy subscribers_admin_read on public.subscribers
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Seed data — mirrors the demo accounts and packages in the Next.js app
-- ---------------------------------------------------------------------------
insert into public.users (id, email, full_name, phone, role, password_hash, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'admin@naujanlake.gov.ph', 'Park Administrator',
   '+63 917 000 0001', 'admin',
   'fc21fbec03dcacbf407b188a496f7a83e57acdac7eb7ebc387dcaaa046cbe66d', '2026-01-05T08:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'visitor@example.com', 'Demo Visitor',
   '+63 917 000 0002', 'visitor',
   '3f0dd34782ec47768171b8e1a8b1980df0cadc01c78e0ac12f510e48d1dd7400', '2026-02-11T08:00:00Z'),
  ('33333333-3333-4333-8333-333333333333', 'ana.reyes@example.com', 'Ana Reyes',
   '+63 918 442 1180', 'visitor',
   'd949210e0d28020725aef6f4c3bbe6e8e38d46881e527487e53d32a0bfca6acc', '2026-09-14T08:00:00Z')
on conflict (email) do nothing;

insert into public.categories (id, name, slug, description, sort_order)
values
  ('c1000000-0000-4000-8000-000000000001', 'Waterbirds & Migratory Birds', 'waterbirds', 'Herons, egrets, ducks and shorebirds recorded on the lake.', 1),
  ('c1000000-0000-4000-8000-000000000002', 'Freshwater Fishes', 'freshwater-fish', 'Native and introduced species of the lake and its river mouths.', 2),
  ('c1000000-0000-4000-8000-000000000003', 'Amphibians & Reptiles', 'amphibians-reptiles', 'Frogs, skinks and water snakes of the marsh edge.', 3),
  ('c1000000-0000-4000-8000-000000000004', 'Mammals', 'mammals', 'Bats and small mammals of the shoreline forest.', 4),
  ('c1000000-0000-4000-8000-000000000005', 'Wetland Flora', 'wetland-flora', 'Reeds, lilies and submerged vegetation.', 5)
on conflict (slug) do nothing;

-- Species catalogue — mirrors lib/species.ts (18 records). `featured_image`
-- points at the park photography already shipped in /public; the per-species
-- gallery is a later FR-1.2 milestone.
insert into public.species
  (category_id, common_name, local_name, scientific_name, conservation_status,
   seasonality, habitat, description, featured_image, slug)
values
  ('c1000000-0000-4000-8000-000000000001', 'Philippine duck', 'Papan', 'Anas luzonica', 'VU', 'RESIDENT', 'Shallow lake margins and flooded grassland', 'A Philippine endemic and the park''s flagship waterbird. Pairs nest in the reeds on the eastern shore; the lake holds one of the few stable populations left in Mindoro.', '/images/species/philippine-duck.webp', 'philippine-duck'),
  ('c1000000-0000-4000-8000-000000000001', 'Little egret', 'Tagak', 'Egretta garzetta', 'LC', 'MIGRATORY', 'Mudflats, fishpond edges and the river mouths', 'Arrives with the northeast monsoon and hunts by shuffling its feet to flush small fish. The white flocks on the northern flats from November onward are mostly this species.', '/images/species/little-egret.webp', 'little-egret'),
  ('c1000000-0000-4000-8000-000000000001', 'Purple heron', null, 'Ardea purpurea', 'LC', 'RESIDENT', 'Tall reed beds and densely vegetated marsh', 'Secretive and easily overlooked — it freezes with its neck vertical when a boat approaches. Best located by its harsh, grating call at dawn.', '/images/species/purple-heron.webp', 'purple-heron'),
  ('c1000000-0000-4000-8000-000000000001', 'Wandering whistling duck', null, 'Dendrocygna arcuata', 'LC', 'RESIDENT', 'Open water and floating vegetation beds', 'Highly gregarious, often counted in flocks of fifty or more. The whistling call carries across the lake well before the birds are visible.', '/images/species/wandering-whistling-duck.webp', 'wandering-whistling-duck'),
  ('c1000000-0000-4000-8000-000000000001', 'Great egret', null, 'Ardea alba', 'LC', 'MIGRATORY', 'Open shallows and drained fishponds', 'The largest white heron on the lake. A winter visitor that arrives thin after the flight from East Asia and spends the first weeks feeding almost continuously.', '/images/species/great-egret.webp', 'great-egret'),
  ('c1000000-0000-4000-8000-000000000002', 'Milkfish', 'Bangus', 'Chanos chanos', 'LC', 'SEASONAL', 'Lake shallows, river mouths and brackish outlets', 'Runs into the lake from coastal waters and is the mainstay of lakeside aquaculture. Juveniles shelter in the flooded margins before returning downstream.', '/images/species/milkfish.webp', 'milkfish'),
  ('c1000000-0000-4000-8000-000000000002', 'Mudfish', 'Dalag', 'Channa striata', 'LC', 'RESIDENT', 'Slow water, mud bottoms and flooded grass', 'An obligate air-breather, which is how it survives the low-oxygen shallows in the dry season. A staple of the local catch and a favourite of herons.', '/images/species/mudfish.webp', 'mudfish'),
  ('c1000000-0000-4000-8000-000000000002', 'Nile tilapia', null, 'Oreochromis niloticus', 'LC', 'RESIDENT', 'Open water and warm shallows', 'Introduced and now widespread. Included here because it is what most visitors actually see at the boat landing — and because it competes with native species for nesting cover.', '/images/species/nile-tilapia.webp', 'nile-tilapia'),
  ('c1000000-0000-4000-8000-000000000002', 'Flathead goby', 'Biya', 'Glossogobius giuris', 'LC', 'RESIDENT', 'Sand and gravel runs near the inlets', 'A small, bottom-dwelling native that sits motionless on the substrate. Common in the clear water where the eastern streams enter the lake.', '/images/species/flathead-goby.webp', 'flathead-goby'),
  ('c1000000-0000-4000-8000-000000000003', 'Common green frog', 'Palaka', 'Hoplobatrachus rugulosus', 'LC', 'RESIDENT', 'Flooded grass and the marsh edge', 'The loudest voice on the lake after heavy rain. Choruses start within an hour of the first downpour and continue well into the night.', '/images/species/common-green-frog.webp', 'common-green-frog'),
  ('c1000000-0000-4000-8000-000000000003', 'Water monitor', 'Bayawak', 'Varanus salvator', 'LC', 'RESIDENT', 'Shoreline forest, marsh edge and floating logs', 'Regularly seen swimming between the reed beds. Despite the size, it avoids boats and is more often heard crashing into the water than watched.', '/images/species/water-monitor.webp', 'water-monitor'),
  ('c1000000-0000-4000-8000-000000000003', 'Many-lined sun skink', null, 'Eutropis multifasciata', 'LC', 'RESIDENT', 'Dry banks, paths and cleared ground', 'The small brown lizard on every sunlit track. Fast, common, and the main reason the park asks visitors to keep to marked paths.', '/images/species/common-sunken-eyed-skink.webp', 'common-sunken-eyed-skink'),
  ('c1000000-0000-4000-8000-000000000004', 'Large flying fox', 'Kabag', 'Pteropus vampyrus', 'EN', 'RESIDENT', 'Remaining lowland forest along the shoreline', 'A fruit bat with a two-metre wingspan that commutes over the lake at dusk. Roost trees are the limiting factor, which is why the shoreline forest is closed to clearing.', '/images/species/large-flying-fox.webp', 'large-flying-fox'),
  ('c1000000-0000-4000-8000-000000000004', 'Common fruit bat', null, 'Rousettus amplexicaudatus', 'LC', 'RESIDENT', 'Caves and dense shoreline trees', 'The smaller, more numerous fruit bat of the lakeside. Unlike the insect-eating bats it is easily seen at dusk, flying a direct line rather than fluttering.', '/images/species/common-fruit-bat.webp', 'common-fruit-bat'),
  ('c1000000-0000-4000-8000-000000000005', 'Blue water lily', 'Lawa-lawaan', 'Nymphaea nouchali', 'LC', 'RESIDENT', 'Still, shallow water over mud', 'Opens in the morning and closes by early afternoon. The floating leaves are the platform small frogs and insects use to cross open water.', '/images/species/blue-water-lily.webp', 'blue-water-lily'),
  ('c1000000-0000-4000-8000-000000000005', 'Common reed', 'Tambô', 'Phragmites australis', 'LC', 'RESIDENT', 'Lake margin and the eastern marsh', 'Forms the tall wall of vegetation that makes the eastern marsh impassable by boat. It is also the nesting cover that keeps the Philippine duck population viable.', '/images/species/common-reed.webp', 'common-reed'),
  ('c1000000-0000-4000-8000-000000000005', 'Water hyacinth', null, 'Eichhornia crassipes', 'LC', 'SEASONAL', 'Nutrient-rich shallows and slow inlets', 'An introduced floating plant that mats over sheltered water in the wet season. The park office clears it from access channels before each tour season.', '/images/species/water-hyacinth.webp', 'water-hyacinth'),
  ('c1000000-0000-4000-8000-000000000005', 'Freshwater mangrove', 'Putat', 'Barringtonia racemosa', 'LC', 'RESIDENT', 'Waterlogged banks and the lake edge', 'Leans out over the water with its roots in the flood line. The pendulous pink flower spikes are the easiest way to identify it from a boat.', '/images/species/freshwater-mangrove.webp', 'freshwater-mangrove')
on conflict (slug) do nothing;

insert into public.tours
  (id, title, slug, category, summary, duration, departure, rate_per_person, max_capacity,
   difficulty, inclusions, what_to_bring, notes, species_slugs, itinerary, tariff, featured_image)
values
  ('e1000000-0000-4000-8000-000000000001', 'Guided birdwatching expedition', 'guided-birdwatching-expedition',
   'Birdwatching',
   'A slow morning run along the marsh edge with a trained spotter, timed to the migratory season and the tide.',
   '3–4 hours', '05:30, park jetty', 1850, 6, 'EASY',
   array['Licensed guide', 'Life jacket', 'Binoculars', 'Environmental fee'],
   array['Neutral-coloured clothing', 'Sun hat and rain shell', 'Reusable water bottle', 'Insect repellent'],
   array['Best between October and March, when migratory species are present.'],
   array['philippine-duck', 'little-egret', 'purple-heron', 'wandering-whistling-duck', 'great-egret'],
   '[{"time":"05:30","title":"Briefing at the jetty","detail":"Life jackets fitted and nesting-season rules."}]'::jsonb,
   '[{"label":"Boat rental and operator","amount":700},{"label":"Licensed birding guide","amount":600},{"label":"Environmental fee","amount":300},{"label":"Binocular hire","amount":250}]'::jsonb,
   '/images/ducklings.jpg'),
  ('e1000000-0000-4000-8000-000000000002', 'Sunrise boat tour', 'sunrise-boat-tour',
   'Scenic',
   'Out before the light, back before the heat. The classic first look at the lake and the mountains behind it.',
   '2 hours', '05:00, park jetty', 1200, 8, 'EASY',
   array['Boat and operator', 'Life jacket', 'Environmental fee'],
   array['Light jacket', 'Camera', 'Reusable water bottle'],
   array['Departs strictly at 05:00 — late arrivals cannot be waited for.'],
   array['blue-water-lily', 'common-reed'],
   '[{"time":"05:00","title":"Departure","detail":"Board at the park jetty while the water is still flat."}]'::jsonb,
   '[{"label":"Boat rental and operator","amount":700},{"label":"Fuel and crew","amount":200},{"label":"Environmental fee","amount":300}]'::jsonb,
   '/images/tours/sunrise-boat-tour.jpg'),
  ('e1000000-0000-4000-8000-000000000003', 'Lakeside community homestay', 'lakeside-community-homestay',
   'Cultural',
   'An overnight with a host family in a lakeside barangay — fishing stories, local cooking, and a dawn paddle.',
   '2 days, 1 night', '14:00, barangay hall', 2400, 4, 'MODERATE',
   array['Homestay', 'All meals', 'Village guide', 'Environmental fee'],
   array['Modest, comfortable clothing', 'Sleeping clothes and towel', 'Refillable water bottle', 'Cash for local purchases'],
   array['Accommodation is basic — shared bathroom, fan-cooled room.'],
   array['milkfish', 'mudfish', 'nile-tilapia'],
   '[{"time":"Day 1 · 14:00","title":"Arrival and orientation","detail":"Meet the host family and the barangay guide."}]'::jsonb,
   '[{"label":"Homestay (per night)","amount":900},{"label":"Meals (4)","amount":700},{"label":"Village guide","amount":500},{"label":"Environmental fee","amount":300}]'::jsonb,
   '/images/tours/lakeside-community-homestay.jpg'),
  ('e1000000-0000-4000-8000-000000000004', 'Educational research trek', 'educational-research-trek',
   'Research',
   'A field session for student groups: transect walks, water sampling points and an introduction to wetland survey methods.',
   '6 hours', '06:00, park office', 1500, 15, 'CHALLENGING',
   array['Research guide', 'Field sheets', 'Boat transfer', 'Environmental fee'],
   array['Closed shoes with grip', 'Long trousers', 'Field notebook and pencil', 'Waterproof bag for devices'],
   array['Group bookings only, minimum of 8 participants.'],
   array['flathead-goby', 'common-green-frog', 'water-monitor', 'common-sunken-eyed-skink',
         'large-flying-fox', 'common-fruit-bat', 'water-hyacinth', 'freshwater-mangrove'],
   '[{"time":"06:00","title":"Safety briefing and method overview","detail":"Survey ethics, permits and data use."}]'::jsonb,
   '[{"label":"Boat transfer","amount":500},{"label":"Research guide","amount":700},{"label":"Environmental fee","amount":300}]'::jsonb,
   '/images/tours/educational-research-trek.jpg')
on conflict (slug) do update
  set species_slugs = excluded.species_slugs
  where public.tours.species_slugs = '{}';

insert into public.advisories
  (id, author_id, title, slug, severity, category, excerpt, content,
   effective_until, actions, published_at, is_active_banner)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Migratory waterbirds begin arriving on the eastern marsh', 'waterbird-arrivals-eastern-marsh', 'INFO', 'Wildlife',
   'Early flocks of egrets and ducks have been recorded ahead of the usual November peak. Birdwatching boats are advised to keep distance from feeding groups.',
   'The park office has logged the first flocks of the season on the eastern marsh — little egrets, great egrets and small parties of whistling duck — roughly three weeks earlier than the November peak of recent years.

The birds arrive thin after the flight south and feed almost continuously for their first fortnight. Disturbance during this window costs them condition they cannot easily recover before the return migration.

Boat operators holding a birdwatching booking should keep at least fifty metres from any raft of birds on open water, and cut engines rather than idling close by. The eastern marsh channel remains open to accredited boats only.',
   '2027-03-31',
   array['Keep 50 m from feeding flocks and switch off the engine when drifting closer.',
         'Binoculars are required for the birdwatching package — do not approach to compensate for missing optics.',
         'Report unusual or tagged birds to the park office with the date and location.'],
   '2026-10-14T08:00:00Z', false),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'Boat speed restricted at the northern river mouths', 'boat-speed-restricted-river-mouths', 'WARNING', 'Water',
   'Sustained rain has raised water levels and pushed debris into the channels. Operators must reduce speed and keep to the marked route.',
   'Rain across the catchment has raised lake levels and carried floating timber and hyacinth mats into the northern river mouths. Two channels that were clear last month now carry debris below the surface.

Until the levels drop, boats must travel at displacement speed through the marked route and give way to any floating vegetation mat, which can hide submerged logs.

The park office is clearing the main access channel weekly. Report new obstructions at the boat landing rather than attempting to move them.',
   '2026-12-15',
   array['Reduce to displacement speed between the river mouths and the main lake.',
         'Keep inside the marked route — the shortcuts are the ones with debris.',
         'Wear the life jacket for the whole crossing, not just the open water.'],
   '2026-10-09T08:00:00Z', false),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'Volunteer briefing for the Asian Waterbird Census', 'waterbird-census-volunteer-briefing', 'INFO', 'Operations',
   'Students and researchers joining the January count are invited to the orientation at the park office. Bring binoculars and a field notebook.',
   'The annual Asian Waterbird Census takes place in the second week of January. Volunteers are counted in teams of three, each with one experienced counter and one GPS unit.

A mandatory orientation is held at the park office covering the count protocol, the sector boundaries and the biosecurity rules for boots and tripods entering the marsh.

Places are limited by boat capacity. Register through the park office before the end of December; transport from Naujan town is provided for registered volunteers.',
   '2027-01-20',
   array['Register before 31 December — places are capped by available boats.',
         'Attend the orientation; counters cannot be deployed without it.',
         'Bring binoculars, a notebook, and footwear you can rinse at the landing.'],
   '2026-09-28T08:00:00Z', false),
  -- The demo build shows this closure in the site-wide banner. Without the row
  -- here, applying the schema would silently drop the banner: the table is no
  -- longer empty, so `lib/advisories.ts` stops falling back to its seeds.
  ('a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'Boat operations suspended under a gale warning', 'gale-warning-boat-suspension', 'CRITICAL', 'Operations',
   'PAGASA has raised a gale warning for the Naujan coast. All boat tours and lake crossings are suspended until the warning is lifted.',
   'The park office has suspended all boat departures after PAGASA raised a gale warning for the Oriental Mindoro coast. This covers guided tours, research crossings and private landings.

The shoreline trail and the viewing deck stay open while conditions allow. Do not move beyond the marked barrier at the jetty.

The suspension is reviewed every morning at 6:00 AM. Bookings already confirmed are moved to the next safe departure at no extra cost.',
   '2026-11-12',
   array['Do not board or launch any boat until the park office lifts the suspension.',
         'Call the park office before travelling if you have a booking this week.',
         'Follow the marked barrier at the jetty and keep children away from the water.'],
   '2026-11-09T08:00:00Z', true),
  ('a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'Reed beds closed to landing during the nesting season', 'reed-bed-nesting-closure', 'WARNING', 'Access',
   'The eastern reed beds are closed to landings while Philippine duck and purple heron are nesting. Boats may pass on the marked channel only.',
   'Philippine duck — the park''s flagship species and a Philippine endemic — nests in the eastern reed beds from September through December. Purple heron nest in the same stand.

Landing, dragging boats onto the vegetation or pushing through the reeds destroys nests that are effectively invisible from the water. A single landing can flatten several.

The marked channel through the eastern marsh stays open. The closure applies to landings and to any boat entering the vegetation, including kayaks and paddle craft.',
   '2026-12-31',
   array['Stay in the marked channel through the eastern marsh.',
         'No landings, no dragging, no pushing into the reeds — including paddle craft.',
         'If a nest is visible from the channel, move on without stopping.'],
   '2026-09-12T08:00:00Z', false),
  ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'Fishpen harvest schedule for the lakeside operators', 'fishpen-harvest-schedule', 'INFO', 'Operations',
   'Registered operators harvest the shallow pens on a rotating schedule through September. Boat traffic at the southern landing will be heavier on those days.',
   'The registered lakeside operators harvest the shallow pens on a rotating schedule through September, with landings concentrated at the southern jetty.

Visitor boats are not excluded, but the landing area will be busy and parking limited on harvest days. Allow extra time before a morning departure.

Buying fish directly at the landing is permitted. The park office asks that visitors do not enter the pens or walk on the netting.',
   null,
   array[]::text[],
   '2026-08-30T08:00:00Z', false),
  ('a1000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'Shoreline trail bridge under repair until November', 'trail-bridge-repair', 'WARNING', 'Access',
   'The timber bridge on the shoreline trail is being replaced. The research trek is rerouted onto the service road for the rest of the season.',
   'The timber bridge carrying the shoreline trail over the western inlet has reached the end of its service life. Replacement work started this month and runs until the end of November.

The educational research trek is rerouted onto the service road for the duration — a slightly longer walk with no shade in the middle section.

The birdwatching and sunrise boat tours are unaffected, as neither uses the trail.',
   '2026-11-30',
   array['Follow the detour signs; do not cross the closed bridge.',
         'Bring a hat and water for the exposed section of the service road.'],
   '2026-08-14T08:00:00Z', false)
on conflict (slug) do nothing;

insert into public.tour_inquiries
  (id, reference_code, tour_id, user_id, full_name, email, phone, target_date, party_size, notes, status, created_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'NL-2026-104882',
   'e1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'Demo Visitor', 'visitor@example.com', '+63 917 000 0002', '2026-11-14', 2,
   'Coming from Calapan, can we leave a motorbike at the jetty?', 'PENDING', '2026-11-06T09:12:00Z'),
  ('d1000000-0000-4000-8000-000000000002', 'NL-2026-103417',
   'e1000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333',
   'Ana Reyes', 'ana.reyes@example.com', '+63 918 442 1180', '2026-11-21', 4,
   'Two of us have binoculars already.', 'CONFIRMED', '2026-11-02T07:40:00Z')
on conflict (reference_code) do nothing;

insert into public.subscribers (email, topics)
values
  ('visitor@example.com', '{advisories,migration}'),
  ('ana.reyes@example.com', '{advisories}'),
  ('research@mindoro-state.edu.ph', '{migration,research}')
on conflict (email) do nothing;
