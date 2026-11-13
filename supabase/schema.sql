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
do $$ begin create type public.inquiry_status as enum ('PENDING', 'CONTACTED', 'CONFIRMED', 'DECLINED'); exception when duplicate_object then null; end $$;
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

-- 2.5 tour_inquiries — booking requests (FR-2.3)
create table if not exists public.tour_inquiries (
  id             uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  tour_id        uuid not null references public.tours (id) on delete restrict,
  user_id        uuid references public.users (id) on delete set null,
  full_name      text not null,
  email          text not null,
  phone          text,
  target_date    date not null,
  party_size     integer not null check (party_size between 1 and 60),
  notes          text,
  status         public.inquiry_status not null default 'PENDING',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tour_inquiries_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$')
);

-- 2.6 advisories — park announcements (Module 4)
create table if not exists public.advisories (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references public.users (id) on delete set null,
  title           text not null,
  slug            text not null unique,
  severity        public.advisory_severity not null,
  excerpt         text not null,
  content         text not null,
  is_active_banner boolean not null default false,
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

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

grant select on public.categories to anon, authenticated;

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists species_public_read on public.species;
create policy species_public_read on public.species for select using (true);

grant select on public.species to anon, authenticated;

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
  for update using (public.is_admin()) with check (public.is_admin());

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

insert into public.tours
  (id, title, slug, category, summary, duration, departure, rate_per_person, max_capacity,
   difficulty, inclusions, what_to_bring, notes, itinerary, tariff, species_slugs, featured_image)
values
  ('d1000000-0000-4000-8000-000000000001', 'Guided birdwatching expedition', 'guided-birdwatching-expedition',
   'Birdwatching',
   'A slow morning run along the marsh edge with a trained spotter, timed to the migratory season and the tide.',
   '3–4 hours', '05:30, park jetty', 1850, 6, 'EASY',
   array['Licensed guide', 'Life jacket', 'Binoculars', 'Environmental fee'],
   array['Neutral-coloured clothing', 'Sun hat and rain shell', 'Reusable water bottle', 'Insect repellent'],
   array['Best between October and March, when migratory species are present.'],
   '[{"time":"05:30","title":"Briefing at the jetty","detail":"Life jackets fitted and nesting-season rules."}]'::jsonb,
   '[{"label":"Boat rental and operator","amount":700},{"label":"Licensed birding guide","amount":600},{"label":"Environmental fee","amount":300},{"label":"Binocular hire","amount":250}]'::jsonb,
   array['philippine-duck', 'little-egret', 'purple-heron', 'wandering-whistling-duck', 'great-egret'],
   '/images/ducklings.jpg'),
  ('d1000000-0000-4000-8000-000000000002', 'Sunrise boat tour', 'sunrise-boat-tour',
   'Scenic',
   'Out before the light, back before the heat. The classic first look at the lake and the mountains behind it.',
   '2 hours', '05:00, park jetty', 1200, 8, 'EASY',
   array['Boat and operator', 'Life jacket', 'Environmental fee'],
   array['Light jacket', 'Camera', 'Reusable water bottle'],
   array['Departs strictly at 05:00 — late arrivals cannot be waited for.'],
   '[{"time":"05:00","title":"Departure","detail":"Board at the park jetty while the water is still flat."}]'::jsonb,
   '[{"label":"Boat rental and operator","amount":700},{"label":"Fuel and crew","amount":200},{"label":"Environmental fee","amount":300}]'::jsonb,
   array['blue-water-lily', 'common-reed'],
   '/images/hero-lake.jpg'),
  ('d1000000-0000-4000-8000-000000000003', 'Lakeside community homestay', 'lakeside-community-homestay',
   'Cultural',
   'An overnight with a host family in a lakeside barangay — fishing stories, local cooking, and a dawn paddle.',
   '2 days, 1 night', '14:00, barangay hall', 2400, 4, 'MODERATE',
   array['Homestay', 'All meals', 'Village guide', 'Environmental fee'],
   array['Modest, comfortable clothing', 'Sleeping clothes and towel', 'Refillable water bottle', 'Cash for local purchases'],
   array['Accommodation is basic — shared bathroom, fan-cooled room.'],
   '[{"time":"Day 1 · 14:00","title":"Arrival and orientation","detail":"Meet the host family and the barangay guide."}]'::jsonb,
   '[{"label":"Homestay (per night)","amount":900},{"label":"Meals (4)","amount":700},{"label":"Village guide","amount":500},{"label":"Environmental fee","amount":300}]'::jsonb,
   array['milkfish', 'mudfish', 'nile-tilapia'],
   '/images/shoreline.jpg'),
  ('d1000000-0000-4000-8000-000000000004', 'Educational research trek', 'educational-research-trek',
   'Research',
   'A field session for student groups: transect walks, water sampling points and an introduction to wetland survey methods.',
   '6 hours', '06:00, park office', 1500, 15, 'CHALLENGING',
   array['Research guide', 'Field sheets', 'Boat transfer', 'Environmental fee'],
   array['Closed shoes with grip', 'Long trousers', 'Field notebook and pencil', 'Waterproof bag for devices'],
   array['Group bookings only, minimum of 8 participants.'],
   '[{"time":"06:00","title":"Safety briefing and method overview","detail":"Survey ethics, permits and data use."}]'::jsonb,
   '[{"label":"Boat transfer","amount":500},{"label":"Research guide","amount":700},{"label":"Environmental fee","amount":300}]'::jsonb,
   array['flathead-goby', 'common-green-frog', 'water-monitor', 'common-sunken-eyed-skink',
         'large-flying-fox', 'common-fruit-bat', 'water-hyacinth', 'freshwater-mangrove'],
   '/images/lake-canopy.jpg')
on conflict (slug) do update
  set species_slugs = excluded.species_slugs
  where public.tours.species_slugs = '{}';

insert into public.advisories (id, author_id, title, slug, severity, excerpt, content, published_at)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Migratory waterbirds begin arriving on the eastern marsh', 'waterbird-arrivals-eastern-marsh', 'INFO',
   'Early flocks of egrets and ducks have been recorded ahead of the usual November peak.',
   'Birdwatching boats are advised to keep distance from feeding groups and to keep engines at idle near roosts.',
   '2026-10-14T08:00:00Z'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'Boat speed restricted at the northern river mouths', 'boat-speed-restricted-river-mouths', 'WARNING',
   'Sustained rain has raised water levels and pushed debris into the channels.',
   'Operators must reduce speed and keep to the marked route until the debris clears.',
   '2026-10-09T08:00:00Z'),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'Volunteer briefing for the Asian Waterbird Census', 'waterbird-census-volunteer-briefing', 'INFO',
   'Students and researchers joining the January count are invited to the orientation at the park office.',
   'Bring binoculars and a field notebook. The briefing runs 09:00–11:00 at the protected area office.',
   '2026-09-28T08:00:00Z')
on conflict (slug) do nothing;

insert into public.tour_inquiries
  (id, reference_code, tour_id, user_id, full_name, email, phone, target_date, party_size, notes, status, created_at)
values
  ('e1000000-0000-4000-8000-000000000001', 'NL-2026-104882',
   'd1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'Demo Visitor', 'visitor@example.com', '+63 917 000 0002', '2026-11-14', 2,
   'Coming from Calapan, can we leave a motorbike at the jetty?', 'PENDING', '2026-11-06T09:12:00Z'),
  ('e1000000-0000-4000-8000-000000000002', 'NL-2026-103417',
   'd1000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333',
   'Ana Reyes', 'ana.reyes@example.com', '+63 918 442 1180', '2026-11-21', 4,
   'Two of us have binoculars already.', 'CONFIRMED', '2026-11-02T07:40:00Z')
on conflict (reference_code) do nothing;

insert into public.subscribers (email, topics)
values
  ('visitor@example.com', '{advisories,migration}'),
  ('ana.reyes@example.com', '{advisories}'),
  ('research@mindoro-state.edu.ph', '{migration,research}')
on conflict (email) do nothing;
