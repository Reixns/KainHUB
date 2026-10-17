-- =============================================================================
-- Lancaster Zone 1 Eats -- authoritative database schema
-- =============================================================================
--
-- HOW TO RUN
--   Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
--
--   This is the ONLY file. Do not go looking for a per-feature one. There used to
--   be a `favorites.sql` alongside this, holding just the `public.favorites`
--   table, and it was a strict subset of the sections below -- it existed only
--   because pasting 1,200 lines to add one table is unpleasant, and keeping it in
--   sync with this file was a second thing to forget. It is gone; the sections
--   here are the source of truth.
--
--   Run this ONE file for both a brand new database and an existing one.
--   It is safe to run as many times as you like: every statement is additive
--   or convergent, and the whole script is wrapped in a single transaction, so
--   if any part fails the database is left exactly as it was.
--
--   A run that would leave `public.favorites` missing, wrongly keyed, or without
--   the grants the client needs, or leave ratings without their protected
--   completed-order write path, FAILS and rolls back rather than reporting
--   success. See the post-condition block immediately before `commit`.
--
--   It is NOT a teardown script. It never deletes application rows, truncates,
--   drops application tables/columns, or weakens row level security. The only
--   table it drops is the temporary `_canonical_columns` table it creates.
--
--   Legacy delivery-fee, free-delivery, minimum-order, subtotal and discount
--   columns are retained for historical records. The current app does not read
--   them, but keeping them avoids irreversible loss of order/accounting data.
--   Legacy `removed_*` backup tables are retained for the same reason.
--
-- WHAT THIS APP DOES NOT HAVE, AND WHY
--   There is no delivery fee, no free-delivery flag, no minimum order and no
--   order discount. Shops and customers settle payment in chat, so those
--   concepts were removed from the product. `vendors.delivery_available`
--   survives: vendors still choose whether they deliver at all, and customers
--   still choose delivery or pick-up at checkout, which is what
--   `orders.fulfillment` records.
--
-- WHERE FAVOURITES AND RATINGS LIVE, IN THIS FILE
--   section 1  the canonical column list, which every table must match
--   section 4  create table, plus the primary key the client's upsert needs
--   section 7  row level security, enabled
--   section 9  the owner-only policy
--   section 10 the grants: authenticated only, and no UPDATE on purpose
--   shop_ratings is created in section 3, limited to owner reads in section 11,
--   and written only through the completed-order RPC; shop averages are streamed
--   through vendors in section 13.
--   section 15 the storage bucket and function verification report
--   before commit  the post-condition that refuses to finish without it
--
-- AFTER RUNNING
--   Sections 15 and 16 print verification reports. Section 15 covers the
--   schema, the functions and the notification dedupe; section 16 covers the
--   `marketplace-media` storage bucket that every image upload depends on.
--   Everything must read `ok`.
--
--   The final statement is `commit`, so the SQL Editor often reports
--   "Success. No rows returned" and shows none of that output. Select the two
--   report blocks and run them on their own to read the results.
--
--   The run prints NOTICE lines from sections 5 to 8; those are informational
--   and expected. Section 7 warns when a unique index has to be skipped
--   because rows already share a value, and section 15 warns when a column is
--   still missing or has the wrong type. Neither warning rolls the transaction
--   back, and each names the table and column to look at.
--
--   An EXCEPTION, by contrast, does roll back. If the run ends in one, the
--   message names the object at fault and nothing was applied.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Extensions and types
-- -----------------------------------------------------------------------------
-- `create type` is not idempotent, so the duplicate_object error is caught and
-- ignored. `duplicate_object` is the only expected failure here.

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('customer', 'vendor', 'admin');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.vendor_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Canonical column list
-- -----------------------------------------------------------------------------
-- The single source of truth for what every table should contain.
--
-- This matters more than it looks. `create table if not exists` silently does
-- nothing when the table already exists, which is exactly how this database
-- drifted in the first place: the original CREATE TABLE statements ran while
-- they were the whole schema, and columns added later were never applied. So a
-- table is declared here once, and section 5 reconciles every column of it
-- against what actually exists.
--
-- `typ` is the output of Postgres' own format_type(), so section 15 can compare
-- it against reality exactly. A column can exist and still be the wrong type --
-- `total` as text instead of numeric(10,2) would silently corrupt order
-- arithmetic -- and `add column if not exists` would never reveal that.
--
-- The seven identity primary keys are the one place this is not literally
-- format_type() output: identity is a column attribute rather than part of the
-- type, so format_type() says `bigint` where this list says `bigint generated
-- by default as identity`. Section 5 needs the full spelling, because adding a
-- missing column that way is what gives it its sequence. Section 15 therefore
-- strips the clause before comparing; see the note there.
--
-- The list is held in an ordinary table rather than `create temporary table ...
-- on commit drop`. A TEMP table with ON COMMIT DROP is discarded at every commit,
-- so it only works if the whole script runs in one transaction; pasted into the
-- Supabase SQL Editor it can be committed away before the later sections read it,
-- which fails with 'relation "_expected" does not exist'. A plain table survives
-- that, is dropped again at the end of this script, and needs no session state
-- shared between statements.

create table if not exists public._canonical_columns (
  tbl text not null,
  col text not null,
  typ text not null,
  primary key (tbl, col)
);

-- Locked down before it holds anything, so that even a run which dies partway
-- through cannot leave a readable table behind: RLS with no policy means nobody
-- but the table owner can read or write it.
alter table public._canonical_columns enable row level security;

insert into public._canonical_columns (tbl, col, typ) values
  -- profiles
  ('profiles',      'id',          'uuid'),
  ('profiles',      'email',       'text'),
  ('profiles',      'role',        'public.app_role'),
  ('profiles',      'full_name',   'text'),
  ('profiles',      'status',      'text'),
  ('profiles',      'mobile',      'text'),
  ('profiles',      'address',     'text'),
  ('profiles',      'avatar',      'text'),
  ('profiles',      'cover_image', 'text'),
  ('profiles',      'created_at',  'timestamp with time zone'),
  ('profiles',      'updated_at',  'timestamp with time zone'),
  -- vendors (no delivery_fee / free_delivery / min_order: removed from the product)
  ('vendors',       'id',                   'bigint generated by default as identity'),
  ('vendors',       'owner_id',             'uuid'),
  ('vendors',       'legacy_id',            'bigint'),
  ('vendors',       'name',                 'text'),
  ('vendors',       'owner_name',           'text'),
  ('vendors',       'email',                'text'),
  ('vendors',       'mobile',               'text'),
  ('vendors',       'address',              'text'),
  ('vendors',       'category',             'text'),
  ('vendors',       'category_id',          'text'),
  ('vendors',       'operating_hours',      'text'),
  ('vendors',       'description',          'text'),
  ('vendors',       'status',               'public.vendor_status'),
  ('vendors',       'store_status',         'text'),
  ('vendors',       'rating',               'numeric(3,2)'),
  ('vendors',       'rating_count',         'integer'),
  ('vendors',       'delivery_available',   'boolean'),
  ('vendors',       'queue',                'integer'),
  ('vendors',       'cover_image',          'text'),
  ('vendors',       'logo',                 'text'),
  ('vendors',       'created_at',           'timestamp with time zone'),
  ('vendors',       'updated_at',           'timestamp with time zone'),
  -- menu_items
  ('menu_items',    'id',          'bigint generated by default as identity'),
  ('menu_items',    'vendor_id',   'bigint'),
  ('menu_items',    'legacy_id',   'bigint'),
  ('menu_items',    'name',        'text'),
  ('menu_items',    'description', 'text'),
  ('menu_items',    'price',       'numeric(10,2)'),
  ('menu_items',    'stock',       'integer'),
  ('menu_items',    'available',   'boolean'),
  ('menu_items',    'image',       'text'),
  ('menu_items',    'created_at',  'timestamp with time zone'),
  ('menu_items',    'updated_at',  'timestamp with time zone'),
  -- orders (no subtotal / delivery_fee / discount: removed, section 9 backs them up)
  ('orders',        'id',                   'bigint generated by default as identity'),
  ('orders',        'order_number',         'text'),
  ('orders',        'customer_id',          'uuid'),
  ('orders',        'vendor_legacy_id',     'bigint'),
  ('orders',        'vendor_owner_id',      'uuid'),
  ('orders',        'customer_name',        'text'),
  ('orders',        'customer_mobile',      'text'),
  ('orders',        'customer_address',     'text'),
  ('orders',        'total',                'numeric(10,2)'),
  ('orders',        'payment_status',       'text'),
  ('orders',        'gcash_ref',            'text'),
  ('orders',        'queue_number',         'integer'),
  ('orders',        'status',               'text'),
  ('orders',        'fulfillment',          'text'),
  ('orders',        'reject_reason',        'text'),
  ('orders',        'payment_method',       'text'),
  ('orders',        'special_instructions', 'text'),
  ('orders',        'timeline',             'jsonb'),
  ('orders',        'created_at',           'timestamp with time zone'),
  ('orders',        'updated_at',           'timestamp with time zone'),
  -- order_items
  ('order_items',   'id',            'bigint generated by default as identity'),
  ('order_items',   'order_id',      'bigint'),
  ('order_items',   'menu_legacy_id','bigint'),
  ('order_items',   'name',          'text'),
  ('order_items',   'price',         'numeric(10,2)'),
  ('order_items',   'quantity',      'integer'),
  ('order_items',   'notes',         'text'),
  -- posts
  ('posts',         'id',             'bigint generated by default as identity'),
  ('posts',         'legacy_id',      'bigint'),
  ('posts',         'author_id',      'uuid'),
  ('posts',         'author_name',    'text'),
  ('posts',         'author_avatar',  'text'),
  ('posts',         'author_role',    'public.app_role'),
  ('posts',         'content',        'text'),
  ('posts',         'type',           'text'),
  ('posts',         'product_id',     'bigint'),
  ('posts',         'vendor_legacy_id','bigint'),
  ('posts',         'product',        'jsonb'),
  ('posts',         'image_url',      'text'),
  ('posts',         'likes',          'integer'),
  ('posts',         'liked_by',       'jsonb'),
  ('posts',         'comments',       'jsonb'),
  ('posts',         'pinned',         'boolean'),
  ('posts',         'hidden',         'boolean'),
  ('posts',         'reported',       'boolean'),
  ('posts',         'report_reason',  'text'),
  ('posts',         'publish_at',     'timestamp with time zone'),
  ('posts',         'expires_at',     'timestamp with time zone'),
  ('posts',         'created_at',     'timestamp with time zone'),
  ('posts',         'updated_at',     'timestamp with time zone'),
  -- notifications
  ('notifications', 'id',         'bigint generated by default as identity'),
  ('notifications', 'legacy_id',  'bigint'),
  ('notifications', 'user_id',    'text'),
  ('notifications', 'type',       'text'),
  ('notifications', 'title',      'text'),
  ('notifications', 'message',    'text'),
  ('notifications', 'read',       'boolean'),
  ('notifications', 'created_at', 'timestamp with time zone'),
  -- When set, the notification is transient: the client sweeps it out of local
  -- state once this passes, and the list filters on it at render. Order status
  -- rows set it (see ORDER_NOTIFICATION_TTL_MS); promo and admin-desk rows leave
  -- it null and never expire. Nullable so every existing row stays valid -- a
  -- null is read as "no expiry" rather than as an already-expired row.
  ('notifications', 'expires_at',  'timestamp with time zone'),
  -- chats
  ('chats',         'id',              'text'),
  ('chats',         'vendor_legacy_id','bigint'),
  ('chats',         'customer_id',     'uuid'),
  ('chats',         'messages',        'jsonb'),
  ('chats',         'updated_at',      'timestamp with time zone'),
  -- post_comments (declared but not referenced from src/ yet)
  ('post_comments', 'id',         'bigint generated by default as identity'),
  ('post_comments', 'post_id',    'bigint'),
  ('post_comments', 'author_id',  'uuid'),
  ('post_comments', 'content',    'text'),
  ('post_comments', 'created_at', 'timestamp with time zone'),
  ('post_comments', 'updated_at', 'timestamp with time zone'),
  -- favorites (a customer's saved shops and dishes)
  ('favorites',     'user_id',          'uuid'),
  ('favorites',     'target_type',      'text'),
  ('favorites',     'target_legacy_id', 'bigint'),
  ('favorites',     'vendor_legacy_id', 'bigint'),
  ('favorites',     'created_at',       'timestamp with time zone')
on conflict (tbl, col) do update
set typ = excluded.typ;

-- -----------------------------------------------------------------------------
-- 3. Tables
-- -----------------------------------------------------------------------------
-- Full modern definitions, for a fresh database. On an existing database these
-- are no-ops and section 5 does the real work.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role public.app_role not null default 'customer',
  full_name text, status text not null default 'active',
  mobile text, address text, avatar text, cover_image text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id bigint generated by default as identity primary key,
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  legacy_id bigint unique,
  name text not null, owner_name text, email text, mobile text, address text,
  category text, category_id text, operating_hours text, description text not null default '',
  status public.vendor_status not null default 'pending',
  store_status text not null default 'CLOSED',
  rating numeric(3,2) not null default 0, delivery_available boolean not null default true,
  queue integer not null default 0, cover_image text, logo text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id bigint generated by default as identity primary key,
  vendor_id bigint not null references public.vendors(id) on delete cascade,
  legacy_id bigint, name text not null, description text not null default '',
  price numeric(10,2) not null check (price >= 0), stock integer not null default 0 check (stock >= 0),
  available boolean not null default true, image text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(vendor_id, legacy_id)
);

create table if not exists public.orders (
  id bigint generated by default as identity primary key,
  order_number text not null unique, customer_id uuid not null references public.profiles(id),
  vendor_legacy_id bigint, vendor_owner_id uuid references public.profiles(id),
  customer_name text, customer_mobile text, customer_address text,
  total numeric(10,2) not null default 0,
  payment_status text, gcash_ref text, queue_number integer,
  status text not null default 'RECEIVED', fulfillment text, reject_reason text,
  payment_method text, special_instructions text not null default '',
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated by default as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  menu_legacy_id bigint, name text not null, price numeric(10,2) not null, quantity integer not null check (quantity > 0),
  notes text not null default ''
);

create table if not exists public.posts (
  id bigint generated by default as identity primary key,
  legacy_id bigint unique, author_id uuid references public.profiles(id) on delete set null,
  author_name text, author_avatar text, author_role public.app_role, content text not null default '',
  type text, product_id bigint, vendor_legacy_id bigint, product jsonb, image_url text,
  likes integer not null default 0, liked_by jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb, pinned boolean not null default false,
  hidden boolean not null default false, reported boolean not null default false, report_reason text,
  publish_at timestamptz, expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigint generated by default as identity primary key,
  legacy_id bigint,
  user_id text not null, type text, title text, message text,
  read boolean not null default false, created_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.chats (
  id text primary key, vendor_legacy_id bigint not null,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now()
);

create table if not exists public.post_comments (
  id bigint generated by default as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- A favourite has no surrogate key on purpose: the row is the triple
-- (owner, kind, target) and nothing else. The browser keeps the same shape with
-- `userId`, `type` and `refId`, so the composite key is the natural key and a
-- synthetic id would only add a column that has to be reconciled on every sync.
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('shop', 'product')),
  target_legacy_id bigint not null,
  -- The shop the target belongs to. Redundant for a 'shop' row and essential for
  -- a 'product' one, where the dish id is not unique across vendors: two shops can
  -- each have a dish with the same id in local mode, and a favourites list has to
  -- be able to name the shop it read the dish from.
  vendor_legacy_id bigint,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_legacy_id)
);

create table if not exists public.shop_ratings (
  order_number text primary key,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vendor_legacy_id bigint not null,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists shop_ratings_vendor_idx
  on public.shop_ratings (vendor_legacy_id);

-- Section 5 can add a missing column to an existing table, but it cannot add a
-- primary key, and this table's composite key *is* the app's natural key: the
-- browser upserts on `user_id, target_type, target_legacy_id` and PostgREST
-- rejects an ON CONFLICT target with no unique index behind it (42P10). A
-- database that already has a `favorites` table without that key -- an earlier
-- draft of this script, say -- would take the insert and then fail every
-- favourite the customer tapped. So the key is asserted here, not assumed.
--
-- `constraint ... if not exists` is not valid Postgres, so existence is checked
-- first. Adding a primary key also builds the unique index the upsert needs, so
-- there is no separate index for it in section 7.
do $$
declare
  pk_cols text[];
begin
  -- The actual column list of whatever primary key is on the table right now.
  select array_agg(a.attname::text order by a.attname) into pk_cols
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  join unnest(c.conkey) as k(attnum) on true
  join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
  where n.nspname = 'public' and t.relname = 'favorites' and c.contype = 'p';

  /*
    Compare the column *set*, not merely "a primary key exists". An earlier draft
    of this script created `favorites` with a surrogate `id` primary key, and the
    old check was satisfied by it -- so the composite key was never added, and
    every favourite the customer tapped failed on the upsert with 42P10 "there is
    no unique or exclusion constraint matching the ON CONFLICT specification". The
    table looked correct and was silently unusable.
  */
  if pk_cols is distinct from array['target_legacy_id', 'target_type', 'user_id'] then
    if pk_cols is not null then
      raise notice 'replacing the wrong primary key on favorites (was: %)', pk_cols;
      alter table public.favorites drop constraint favorites_pkey;
    end if;
    alter table public.favorites
      add constraint favorites_pkey primary key (user_id, target_type, target_legacy_id);
    raise notice 'added the primary key favorites needs for its upserts';
  end if;
end $$;

-- Notifications are addressed to a user, so the same event id must be allowed
-- once for each admin. Remove the old global key before section 7 creates the
-- per-recipient key used by both the RPC and the client.
alter table public.notifications drop constraint if exists notifications_legacy_id_key;
drop index if exists public.notifications_legacy_id_key;

-- Separate lines for one dish may carry different customer notes. The old
-- (order_id, menu_legacy_id) key collapsed those lines into one and made a
-- multi-line upsert fail or overwrite the earlier note.
alter table public.order_items
  drop constraint if exists order_items_order_id_menu_legacy_id_key;
drop index if exists public.order_items_order_id_menu_legacy_id_key;
update public.order_items set notes = '' where notes is null;
alter table public.order_items alter column notes set default '';
alter table public.order_items alter column notes set not null;

-- -----------------------------------------------------------------------------
-- 4. Align the definitions with the canonical list
-- -----------------------------------------------------------------------------
-- Section 2 lists the columns with no NOT NULL / DEFAULT, so a fresh table
-- created in section 3 would otherwise differ from an existing table that has
-- them. These are the constraints that carry meaning for the app.

alter table public.profiles alter column email drop not null;

alter table public.vendors alter column owner_id drop not null;
alter table public.vendors alter column description set default '';
alter table public.vendors alter column store_status set default 'CLOSED';
alter table public.vendors alter column rating set default 0;
alter table public.vendors alter column delivery_available set default true;
alter table public.vendors alter column queue set default 0;

alter table public.menu_items alter column description set default '';
alter table public.menu_items alter column stock set default 0;
alter table public.menu_items alter column available set default true;

alter table public.orders alter column total set default 0;
alter table public.orders alter column status set default 'RECEIVED';
alter table public.orders alter column special_instructions set default '';
alter table public.orders alter column timeline set default '[]'::jsonb;

alter table public.notifications alter column read set default false;

-- -----------------------------------------------------------------------------
-- 5. Reconcile: add every expected column that is missing
-- -----------------------------------------------------------------------------
-- This is the step that fixes an existing database. Types are taken from the
-- canonical list, and `if not exists` makes a second run a no-op.

do $$
declare
  missing record;
begin
  for missing in
    select e.tbl, e.col, e.typ
    from public._canonical_columns e
    left join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = e.tbl
     and c.column_name = e.col
    where c.column_name is null
    order by e.tbl, e.col
  loop
    execute format('alter table public.%I add column if not exists %I %s', missing.tbl, missing.col, missing.typ);
    raise notice 'added %.% (%)', missing.tbl, missing.col, missing.typ;
  end loop;
end $$;

update public.profiles set status = 'active' where status is null;
alter table public.profiles alter column status set default 'active';
alter table public.profiles alter column status set not null;
update public.vendors set rating_count = 0 where rating_count is null;
alter table public.vendors alter column rating_count set default 0;
alter table public.vendors alter column rating_count set not null;

-- Keep order versions monotonic across KDS updates, even for clients that do
-- not explicitly send updated_at. The app merges remote and local orders by
-- this timestamp, so a stale timestamp can restore an older KDS stage.
create or replace function public.set_order_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_order_updated_at();

create or replace function public.rate_completed_order(p_order_number text, p_rating integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_vendor_legacy_id bigint;
  v_rating numeric(3,2);
  v_rating_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in as a customer to rate a shop.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'customer'::public.app_role
  ) then
    raise exception 'Only customer accounts can rate shops.';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'A shop rating must be between 1 and 5 stars.';
  end if;

  select vendor_legacy_id into v_vendor_legacy_id
  from public.orders
  where order_number = p_order_number
    and customer_id = auth.uid()
    and status = 'COMPLETED'
  for update;

  if not found then
    raise exception 'Only your completed orders can be rated.';
  end if;

  insert into public.shop_ratings (order_number, customer_id, vendor_legacy_id, rating)
  values (p_order_number, auth.uid(), v_vendor_legacy_id, p_rating)
  on conflict (order_number) do nothing;

  if not found then
    raise exception 'This order has already been rated.';
  end if;

  update public.vendors
  set rating = ((rating * rating_count + p_rating)::numeric / (rating_count + 1)),
      rating_count = rating_count + 1
  where legacy_id = v_vendor_legacy_id
     or (legacy_id is null and id = v_vendor_legacy_id)
  returning rating, rating_count into v_rating, v_rating_count;

  if not found then
    raise exception 'The shop for this order could not be found.';
  end if;

  return jsonb_build_object('rating', v_rating, 'rating_count', v_rating_count);
end;
$$;

revoke all on function public.rate_completed_order(text, integer) from public, anon;
grant execute on function public.rate_completed_order(text, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Repair legacy_id values minted as fractions
-- -----------------------------------------------------------------------------
-- Rows created by the browser used `Date.now() + Math.random()` for their id, so
-- the value written into a `bigint` column was fractional. Postgres does not
-- reject that: it assignment-casts numeric to bigint and rounds half-up,
-- silently. The write reported success, the server kept a number the app had
-- never seen, and the next read produced an id that matched no local row --
-- which is how one order ended up stored twice, once under the fraction and
-- once under its rounded value.
--
-- The browser side of this repair lives in `repairFractionalIds`
-- (src/context/persistence.js) and runs on load. This section fixes the rows
-- the server is holding.
--
-- Rounding here is deliberate, not a cast: `::bigint` and `round()` both agree
-- with the server's own behaviour, and re-running is a no-op because a value
-- that is already integral is unchanged.
--
-- Nothing is deleted. A row whose rounded id is not already taken is simply
-- rounded. Where two rows really do collapse onto one id, the duplicate is left
-- in place and reported by section 15 rather than silently merged: choosing
-- which copy to keep would mean discarding order or money data, and that is not
-- a decision this script should make on its own.

do $$
declare
  collisions int;
begin
  -- Report first, so the numbers below describe the state being changed.
  raise notice 'fractional legacy_id values to normalise:';
  raise notice '  vendors        %', (select count(*) from public.vendors  where legacy_id is not null and legacy_id <> round(legacy_id));
  raise notice '  menu_items     %', (select count(*) from public.menu_items where legacy_id is not null and legacy_id <> round(legacy_id));
  raise notice '  orders         %', (select count(*) from public.orders  where vendor_legacy_id is not null and vendor_legacy_id <> round(vendor_legacy_id));
  raise notice '  order_items    %', (select count(*) from public.order_items where menu_legacy_id is not null and menu_legacy_id <> round(menu_legacy_id));
  raise notice '  posts          %', (select count(*) from public.posts   where legacy_id is not null and legacy_id <> round(legacy_id));
  raise notice '  notifications  %', (select count(*) from public.notifications where legacy_id is not null and legacy_id <> round(legacy_id));
  raise notice '  chats          %', (select count(*) from public.chats   where vendor_legacy_id is not null and vendor_legacy_id <> round(vendor_legacy_id));
end $$;

-- A row whose id is not already taken by a different row only needs rounding.
-- `and not exists (... equal legacy_id)` is what makes this safe to repeat: the
-- second run finds the rounded value already present and skips the row.
with fractional as (
  select id, legacy_id, round(legacy_id)::bigint as rounded
  from public.vendors
  where legacy_id is not null and legacy_id <> round(legacy_id)
    and not exists (
      select 1 from public.vendors other
      where other.legacy_id = round(public.vendors.legacy_id) and other.id <> public.vendors.id
    )
)
update public.vendors v
set legacy_id = f.rounded, updated_at = now()
from fractional f
where v.id = f.id;

with fractional as (
  select id, round(legacy_id)::bigint as rounded
  from public.menu_items
  where legacy_id is not null and legacy_id <> round(legacy_id)
    and not exists (
      select 1 from public.menu_items other
      where other.legacy_id = round(public.menu_items.legacy_id) and other.id <> public.menu_items.id
    )
)
update public.menu_items m
set legacy_id = f.rounded, updated_at = now()
from fractional f
where m.id = f.id;

with fractional as (
  select id, round(legacy_id)::bigint as rounded
  from public.posts
  where legacy_id is not null and legacy_id <> round(legacy_id)
    and not exists (
      select 1 from public.posts other
      where other.legacy_id = round(public.posts.legacy_id) and other.id <> public.posts.id
    )
)
update public.posts p
set legacy_id = f.rounded, updated_at = now()
from fractional f
where p.id = f.id;

with fractional as (
  select id, round(legacy_id)::bigint as rounded
  from public.notifications
  where legacy_id is not null and legacy_id <> round(legacy_id)
    and not exists (
      select 1 from public.notifications other
      where other.legacy_id = round(public.notifications.legacy_id) and other.id <> public.notifications.id
    )
)
update public.notifications n
set legacy_id = f.rounded
from fractional f
where n.id = f.id;

-- Foreign keys. These are repaired after their targets so they point at the
-- rounded id rather than one that no longer exists.
update public.orders  set vendor_legacy_id  = round(vendor_legacy_id)::bigint  where vendor_legacy_id  is not null and vendor_legacy_id  <> round(vendor_legacy_id);
update public.chats   set vendor_legacy_id  = round(vendor_legacy_id)::bigint  where vendor_legacy_id  is not null and vendor_legacy_id  <> round(vendor_legacy_id);
update public.posts   set vendor_legacy_id  = round(vendor_legacy_id)::bigint  where vendor_legacy_id  is not null and vendor_legacy_id  <> round(vendor_legacy_id);
update public.posts   set product_id        = round(product_id)::bigint        where product_id        is not null and product_id        <> round(product_id);
update public.order_items set menu_legacy_id = round(menu_legacy_id)::bigint where menu_legacy_id is not null and menu_legacy_id <> round(menu_legacy_id);

-- Repair older orders whose vendor owner was not recorded. The vendor RLS
-- policies below use this link to let the shop advance its own order statuses.
update public.orders o
set vendor_owner_id = v.owner_id
from public.vendors v
where o.vendor_owner_id is null
  and v.owner_id is not null
  and (
    v.legacy_id = o.vendor_legacy_id
    or (v.legacy_id is null and v.id = o.vendor_legacy_id)
  );

-- Two menu items whose fractional ids rounded onto the same value now share a
-- `legacy_id`. They are deliberately left alone: the unique index in section 7
-- covers the pair `(vendor_id, legacy_id)`, so they only collide if they are
-- also the same vendor, and the duplicates report in section 15 names them for
-- a decision. Rewriting `vendor_id` here would move a dish to a different shop
-- and could break the composite unique constraint rather than fix anything.

-- -----------------------------------------------------------------------------
-- 7. Unique indexes the app's upserts depend on
-- -----------------------------------------------------------------------------
-- Each of these backs an onConflict target in src/lib/supabase/state.js:
--   posts.legacy_id, orders.order_number, menu_items(vendor_id, legacy_id)
--   vendors.owner_id (handle_new_user), notifications(user_id, legacy_id)
--
-- `create unique index if not exists` matches on NAME. Postgres already names a
-- constraint-created index <table>_<columns>_key, which is exactly the name
-- used below, so on a database that already has these the statement is a no-op
-- rather than a redundant second index. Section 7 runs after the fractional-id
--
-- Section 6 has already normalised the fractional ids this check used to trip
-- not an error: the index is skipped, the rest of this script still runs, and
-- over, so a duplicate here means two genuinely different rows. This is a warning,
-- Postgres answers 42P10.

do $$
declare
  spec record;
  dup_groups bigint;
begin
  for spec in
    select * from (values
      ('notifications', 'user_id, legacy_id',              'notifications_user_id_legacy_id_key'),
      ('posts',         'legacy_id',                       'posts_legacy_id_key'),
      ('orders',        'order_number',                    'orders_order_number_key'),
      ('vendors',       'owner_id',                        'vendors_owner_id_key'),
      ('menu_items',    'vendor_id, legacy_id',            'menu_items_vendor_id_legacy_id_key'),
      ('order_items',   'order_id, menu_legacy_id, notes', 'order_items_order_id_menu_legacy_id_notes_key'),
      ('vendors',       'legacy_id',                       'vendors_legacy_id_key')
    ) as v(tbl, cols, idx)
  loop
    execute format(
      'select count(*) from (
         select %1$s from public.%2$I
         where (%1$s) is not null
         group by %1$s
         having count(*) > 1
       ) d',
      spec.cols, spec.tbl
    ) into dup_groups;

    if dup_groups > 0 then
      raise warning 'SKIPPED %: % group(s) of rows in public.% share a duplicate value. Deduplicate them by hand, then re-run this file.', spec.idx, dup_groups, spec.tbl;
    else
      execute format('create unique index if not exists %I on public.%I (%s)', spec.idx, spec.tbl, spec.cols);
      raise notice 'unique index % ensured', spec.idx;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 8. Functions and the signup trigger
-- -----------------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.protect_vendor_approval_status() returns trigger
  language plpgsql set search_path = public, auth as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change vendor approval status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_role() returns trigger
  language plpgsql set search_path = public, auth as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change account role or status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
drop trigger if exists profiles_protect_account_fields on public.profiles;
create trigger profiles_protect_account_fields
  before update of role, status on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists vendors_protect_approval_status on public.vendors;
create trigger vendors_protect_approval_status
  before update of status on public.vendors
  for each row execute function public.protect_vendor_approval_status();

create or replace function public.admin_delete_account(p_user_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth, pg_temp
as $$
declare
  target_role public.app_role;
  target_vendor_ids bigint[];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an authenticated admin can delete accounts'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'A different customer or vendor account must be selected'
      using errcode = '22023';
  end if;

  select role into target_role
  from public.profiles
  where id = p_user_id;

  if not found then
    if exists (select 1 from public.vendors where owner_id = p_user_id) then
      target_role := 'vendor'::public.app_role;
    else
      raise exception 'The account does not exist'
        using errcode = 'P0002';
    end if;
  end if;

  if exists (select 1 from public.vendors where owner_id = p_user_id) then
    target_role := 'vendor'::public.app_role;
  end if;

  if target_role not in ('customer'::public.app_role, 'vendor'::public.app_role) then
    raise exception 'Only customer and vendor accounts can be deleted'
      using errcode = '42501';
  end if;

  select array_agg(distinct vendor_id)
  into target_vendor_ids
  from public.vendors v
  cross join lateral (values (v.id), (v.legacy_id)) ids(vendor_id)
  where v.owner_id = p_user_id and ids.vendor_id is not null;

  delete from public.orders
  where customer_id = p_user_id
     or vendor_owner_id = p_user_id
     or (target_role = 'vendor' and vendor_legacy_id = any(coalesce(target_vendor_ids, '{}'::bigint[])));

  delete from public.chats
  where customer_id = p_user_id
     or (target_role = 'vendor' and vendor_legacy_id = any(coalesce(target_vendor_ids, '{}'::bigint[])));

  if target_role = 'vendor' then
    delete from public.favorites
    where (target_type = 'shop' and target_legacy_id = any(coalesce(target_vendor_ids, '{}'::bigint[])))
       or vendor_legacy_id = any(coalesce(target_vendor_ids, '{}'::bigint[]));
  end if;

  delete from public.posts
  where author_id = p_user_id
     or (target_role = 'vendor' and vendor_legacy_id = any(coalesce(target_vendor_ids, '{}'::bigint[])));
  delete from public.notifications where user_id = p_user_id::text;

  delete from auth.users where id = p_user_id;
  if not found then
    raise exception 'The authentication account could not be deleted'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_delete_account(uuid) from public;
grant execute on function public.admin_delete_account(uuid) to authenticated;

create or replace function public.admin_reset_data()
  returns void
  language plpgsql
  security definer
  set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an authenticated admin can reset platform data'
      using errcode = '42501';
  end if;

  delete from public.post_comments where true;
  delete from public.favorites where true;
  delete from public.notifications where true;
  delete from public.chats where true;
  delete from public.order_items where true;
  delete from public.orders where true;
  delete from public.posts where true;
  delete from public.menu_items where true;
  delete from public.vendors where true;

  delete from auth.users u
  where u.id <> auth.uid()
    and not exists (
      select 1
      from public.profiles p
      where p.id = u.id
        and p.role = 'admin'::public.app_role
    );

  delete from public.profiles p
  where p.id <> auth.uid()
    and p.role <> 'admin'::public.app_role;

  if exists (select 1 from public.vendors)
     or exists (select 1 from public.menu_items)
     or exists (select 1 from public.orders)
     or exists (select 1 from public.order_items)
     or exists (select 1 from public.posts)
     or exists (select 1 from public.post_comments)
     or exists (select 1 from public.notifications)
     or exists (select 1 from public.chats)
     or exists (select 1 from public.favorites)
     or exists (
       select 1 from public.profiles
       where id <> auth.uid() and role <> 'admin'::public.app_role
     )
     or exists (
       select 1
       from auth.users u
       where u.id <> auth.uid()
         and not exists (
           select 1 from public.profiles p
           where p.id = u.id and p.role = 'admin'::public.app_role
         )
     ) then
    raise exception 'Reset incomplete: application records or non-admin accounts remain'
      using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.admin_reset_data() from public;
grant execute on function public.admin_reset_data() to authenticated;

/*
  Raise a notification for the admin desk.

  Account alerts are raised by a customer or vendor -- a new registration, or a
  lockout after repeated failed logins -- so nobody is signed in as an admin when
  they are created and there is no admin id to address them to.

  The app held them as `userId: 'admin'` and the write path accepted that literal
  for every role, then stored `user_id = auth.uid()`. Every alert therefore landed
  in the registering customer's own notification list, where the admin screens
  (which look for their own id) never saw it. The literal is no longer accepted.

  This function is the replacement. It is SECURITY DEFINER so it can read the
  admin ids that the caller's role cannot see, and it inserts the alert once per
  admin, so the row is owned by the person meant to read it.

  The caller cannot choose the recipient: every admin gets the alert and the
  type and text are constrained here. A signed-in user can therefore cause an
  account alert to exist, but cannot aim one at another account, invent its
  contents, or present it as a security/order/promotion notification.
*/
create or replace function public.notify_admin_desk(
  p_legacy_id bigint, p_title text, p_message text, p_type text
)
  returns setof uuid
  language plpgsql security definer set search_path = public as $$
declare
  admin_row record;
begin
  if p_legacy_id is null then
    raise exception 'notify_admin_desk: p_legacy_id is required';
  end if;

  for admin_row in
    select id from public.profiles where role = 'admin'::public.app_role
  loop
    /*
      legacy_id is the alert id the client already minted for the local
      notification. The recipient-scoped key makes this idempotent per admin:
      each admin gets one copy, and retries do not add duplicates. Returning the
      admin id either way keeps the caller informed.
    */
    insert into public.notifications (legacy_id, user_id, type, title, message, read)
    values (
      p_legacy_id,
      admin_row.id::text,
      -- Only the three account kinds this app raises. Anything else would let
      -- the caller address the desk with an arbitrary notification type.
      case when p_type in ('security', 'order', 'promotion') then p_type else 'account' end,
      -- Length-capped here rather than trusted from the client: these columns
      -- are text and the caller supplies them.
      left(coalesce(p_title, 'Account activity'), 200),
      left(coalesce(p_message, ''), 1000),
      false
    )
    on conflict (user_id, legacy_id) do nothing;

    return next admin_row.id;
  end loop;
  return;
end;
$$;

revoke all on function public.notify_admin_desk(bigint, text, text, text) from public;
grant execute on function public.notify_admin_desk(bigint, text, text, text) to authenticated;

/*
  The two-argument shape of this function existed briefly and inserted a fresh
  row on every call, because it had no id to collide on. Dropping it keeps the
  only callable version the idempotent one.
*/
drop function if exists public.notify_admin_desk(text, text);

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (new.id, new.email,
    case when new.raw_user_meta_data->>'role' = 'vendor' then 'vendor'::public.app_role else 'customer'::public.app_role end,
    new.raw_user_meta_data->>'fullName')
  on conflict (id) do update set email = excluded.email;

  if (coalesce(new.raw_user_meta_data->>'role', 'customer') = 'vendor') then
    insert into public.vendors (owner_id, name, owner_name, email, mobile, address, category, category_id, operating_hours, description)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'shopName', 'New vendor'),
      new.raw_user_meta_data->>'fullName',
      new.email,
      new.raw_user_meta_data->>'mobile',
      new.raw_user_meta_data->>'address',
      new.raw_user_meta_data->>'category',
      regexp_replace(lower(coalesce(new.raw_user_meta_data->>'category', '')), '\s+', '-', 'g'),
      new.raw_user_meta_data->>'operatingHours',
      coalesce(new.raw_user_meta_data->>'description', '')
    )
    on conflict (owner_id) do nothing;
  end if;
  return new;
end; $$;

-- Dropped first so a trigger that already exists under this name is replaced
-- rather than duplicated, which would fire handle_new_user twice per signup.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 9. Backfills (all idempotent)
-- -----------------------------------------------------------------------------
-- Repair any auth user left without a profile row, which would otherwise be
-- invisible in the admin portal.

insert into public.profiles (id, email, role, full_name)
select
  u.id, u.email,
  case when coalesce(u.raw_user_meta_data->>'role', 'customer') = 'vendor'
    then 'vendor'::public.app_role else 'customer'::public.app_role end,
  u.raw_user_meta_data->>'fullName'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do update
set email = excluded.email,
    role = excluded.role,
    full_name = excluded.full_name,
    updated_at = now();

-- Existing vendor rows are the source of truth for vendor roles.
update public.profiles p
set role = 'vendor'::public.app_role, updated_at = now()
from public.vendors v
where v.owner_id = p.id and p.role <> 'admin'::public.app_role;

-- Attach older vendor posts to their vendor.
update public.posts p
set vendor_legacy_id = coalesce(v.legacy_id, v.id), updated_at = now()
from public.vendors v
where p.author_id = v.owner_id and p.vendor_legacy_id is null;

-- -----------------------------------------------------------------------------
-- 10. Preserve legacy order/accounting fields
-- -----------------------------------------------------------------------------
-- The current app no longer reads delivery fees, free-delivery flags,
-- minimum-order amounts, subtotals or discounts. Do not drop those columns or
-- the `removed_*` backup tables here: old rows may still contain values needed
-- for historical reconciliation, and removing them would be irreversible.

-- -----------------------------------------------------------------------------
-- 11. Row level security
-- -----------------------------------------------------------------------------
-- Enabling RLS is idempotent. Nothing here weakens it.

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.posts enable row level security;
alter table public.notifications enable row level security;
alter table public.chats enable row level security;
alter table public.post_comments enable row level security;
alter table public.favorites enable row level security;
alter table public.shop_ratings enable row level security;

-- Every policy is dropped before being recreated. `create policy` has no
-- "if not exists" form, so without the drop a second run would abort on
-- "policy already exists" and, inside this transaction, roll back everything.
--
-- The definitions are unchanged from the ones already in production; recreating
-- them brings a database that is missing one, or that has been hand-edited,
-- back in line with the intended access rules.

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_read_vendor_customers on public.profiles;
create policy profiles_read_vendor_customers on public.profiles for select using (
  exists (select 1 from public.orders o where o.customer_id = profiles.id and o.vendor_owner_id = auth.uid())
  or exists (
    select 1 from public.chats c
    join public.vendors v on (v.legacy_id = c.vendor_legacy_id or v.id = c.vendor_legacy_id)
    where c.customer_id = profiles.id and v.owner_id = auth.uid()
  )
);

drop policy if exists profiles_update_own on public.profiles;
-- The trigger above prevents an account from changing its own role while still
-- allowing it to update the rest of its profile.
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check ((id = auth.uid() and role <> 'admin') or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check ((id = auth.uid() and role = 'customer') or public.is_admin());

drop policy if exists vendors_public_read on public.vendors;
create policy vendors_public_read on public.vendors for select
  using (status = 'approved' or owner_id = auth.uid() or public.is_admin());

drop policy if exists vendors_owner_write on public.vendors;
create policy vendors_owner_write on public.vendors for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists menu_public_read on public.menu_items;
create policy menu_public_read on public.menu_items for select using (
  exists (select 1 from vendors v where v.id = vendor_id and (v.status = 'approved' or v.owner_id = auth.uid() or public.is_admin()))
);

drop policy if exists menu_owner_write on public.menu_items;
create policy menu_owner_write on public.menu_items for all
  using (exists (select 1 from vendors v where v.id = vendor_id and (v.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from vendors v where v.id = vendor_id and (v.owner_id = auth.uid() or public.is_admin())));

drop policy if exists orders_participant on public.orders;
create policy orders_participant on public.orders for select
  using (
    customer_id = auth.uid()
    or vendor_owner_id = auth.uid()
    or exists (
      select 1 from public.vendors v
      where v.owner_id = auth.uid()
        and (
          v.legacy_id = public.orders.vendor_legacy_id
          or (v.legacy_id is null and v.id = public.orders.vendor_legacy_id)
        )
    )
    or public.is_admin()
  );

drop policy if exists orders_customer_insert on public.orders;
create policy orders_customer_insert on public.orders for insert
  with check (customer_id = auth.uid());

drop policy if exists orders_participant_update on public.orders;
create policy orders_participant_update on public.orders for update
  using (
    customer_id = auth.uid()
    or vendor_owner_id = auth.uid()
    or exists (
      select 1 from public.vendors v
      where v.owner_id = auth.uid()
        and (
          v.legacy_id = public.orders.vendor_legacy_id
          or (v.legacy_id is null and v.id = public.orders.vendor_legacy_id)
        )
    )
    or public.is_admin()
  )
  with check (
    customer_id = auth.uid()
    or vendor_owner_id = auth.uid()
    or exists (
      select 1 from public.vendors v
      where v.owner_id = auth.uid()
        and (
          v.legacy_id = public.orders.vendor_legacy_id
          or (v.legacy_id is null and v.id = public.orders.vendor_legacy_id)
        )
    )
    or public.is_admin()
  );

-- Every policy below is dropped before it is recreated. `create policy` has no
-- IF NOT EXISTS, so a second run of this script otherwise aborts with
-- 42710 "policy ... already exists" and leaves the rest unapplied.
--
-- The per-command split exists because an INSERT is checked against WITH
-- CHECK, not USING. A single FOR ALL policy with only a USING clause made the
-- insert fall back to that expression, which resolves `order_id` against the
-- row being written before the parent order is visible to the statement, and
-- Postgres rejected every item with 42501 "new row violates row-level security
-- policy for table order_items".
drop policy if exists order_items_participant on public.order_items;
drop policy if exists order_items_participant_select on public.order_items;
drop policy if exists order_items_participant_insert on public.order_items;
drop policy if exists order_items_participant_update on public.order_items;
drop policy if exists order_items_participant_delete on public.order_items;

create policy order_items_participant_select on public.order_items for select
  using (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.vendor_owner_id = auth.uid() or public.is_admin()))
  );

create policy order_items_participant_insert on public.order_items for insert
  with check (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.vendor_owner_id = auth.uid() or public.is_admin()))
  );

create policy order_items_participant_update on public.order_items for update
  using (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.vendor_owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.vendor_owner_id = auth.uid() or public.is_admin()))
  );

create policy order_items_participant_delete on public.order_items for delete
  using (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.vendor_owner_id = auth.uid() or public.is_admin()))
  );

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select
  using (not hidden or author_id = auth.uid() or public.is_admin());

drop policy if exists posts_owner_write on public.posts;
create policy posts_owner_write on public.posts for all
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for all
  using (user_id = auth.uid()::text or public.is_admin())
  with check (user_id = auth.uid()::text or public.is_admin());

drop policy if exists chats_participant on public.chats;
create policy chats_participant on public.chats for all
  using (  customer_id = auth.uid()
        or public.is_admin()
        or exists (select 1 from vendors v where (v.legacy_id = vendor_legacy_id or v.id = vendor_legacy_id) and v.owner_id = auth.uid())
) with check (
  customer_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from vendors v where (v.legacy_id = vendor_legacy_id or v.id = vendor_legacy_id) and v.owner_id = auth.uid())
);

create or replace function public.append_chat_message(
  p_chat_id text,
  p_vendor_legacy_id bigint,
  p_customer_id uuid,
  p_message jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  sender_role text := p_message ->> 'senderRole';
  sender_id text := p_message ->> 'senderId';
begin
  if caller_id is null then
    raise exception 'Authentication is required to send chat messages' using errcode = '42501';
  end if;
  if p_message is null
     or jsonb_typeof(p_message) <> 'object'
     or nullif(p_message ->> 'id', '') is null then
    raise exception 'Invalid chat message' using errcode = '22023';
  end if;

  if sender_role = 'customer' then
    if p_customer_id <> caller_id or sender_id <> p_customer_id::text then
      raise exception 'Customers may only send messages in their own chats' using errcode = '42501';
    end if;
  elsif sender_role = 'vendor' then
    if not exists (
      select 1 from public.vendors v
      where (v.legacy_id = p_vendor_legacy_id or v.id = p_vendor_legacy_id)
        and v.owner_id = caller_id
        and coalesce(v.legacy_id, v.id)::text = sender_id
    ) then
      raise exception 'Vendor does not own this chat' using errcode = '42501';
    end if;
  else
    raise exception 'Only chat participants may send messages' using errcode = '42501';
  end if;

  insert into public.chats (id, vendor_legacy_id, customer_id, messages, updated_at)
  values (p_chat_id, p_vendor_legacy_id, p_customer_id, '[]'::jsonb, now())
  on conflict (id) do nothing;

  update public.chats c
  set messages = coalesce(c.messages, '[]'::jsonb) || jsonb_build_array(p_message),
      updated_at = now()
  where c.id = p_chat_id
    and c.vendor_legacy_id = p_vendor_legacy_id
    and c.customer_id = p_customer_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(c.messages, '[]'::jsonb)) existing
      where existing ->> 'id' = p_message ->> 'id'
    );

  if not found and not exists (
    select 1
    from public.chats c
    where c.id = p_chat_id
      and c.vendor_legacy_id = p_vendor_legacy_id
      and c.customer_id = p_customer_id
  ) then
    raise exception 'Chat does not match the supplied participants' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.append_chat_message(text, bigint, uuid, jsonb) from public, anon;
grant execute on function public.append_chat_message(text, bigint, uuid, jsonb) to authenticated;

create or replace function public.update_chat_message_reactions(
  p_chat_id text,
  p_vendor_legacy_id bigint,
  p_customer_id uuid,
  p_message_id text,
  p_reactions jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication is required to update chat reactions' using errcode = '42501';
  end if;
  if jsonb_typeof(p_reactions) <> 'array' then
    raise exception 'Reactions must be an array' using errcode = '22023';
  end if;
  if caller_id <> p_customer_id and not exists (
    select 1 from public.vendors v
    where (v.legacy_id = p_vendor_legacy_id or v.id = p_vendor_legacy_id)
      and v.owner_id = caller_id
  ) then
    raise exception 'Only chat participants may update reactions' using errcode = '42501';
  end if;

  update public.chats c
  set messages = (
        select jsonb_agg(
          case
            when item.message ->> 'id' = p_message_id
              then jsonb_set(item.message, '{reactions}', p_reactions, true)
            else item.message
          end
          order by item.ordinality
        )
        from jsonb_array_elements(coalesce(c.messages, '[]'::jsonb))
          with ordinality as item(message, ordinality)
      ),
      updated_at = now()
  where c.id = p_chat_id
    and c.vendor_legacy_id = p_vendor_legacy_id
    and c.customer_id = p_customer_id
    and exists (
      select 1
      from jsonb_array_elements(coalesce(c.messages, '[]'::jsonb)) message
      where message ->> 'id' = p_message_id
    );
end;
$$;

revoke all on function public.update_chat_message_reactions(text, bigint, uuid, text, jsonb) from public, anon;
grant execute on function public.update_chat_message_reactions(text, bigint, uuid, text, jsonb) to authenticated;

-- A favourites list is private to the account that owns it, so the policy is
-- keyed on user_id only and there is no admin escape hatch: nothing in the app
-- needs to read somebody else's favourites, and allowing it would expose a
-- browsing history that the owner never agreed to share.
--
-- `for all` covers the delete as well as the insert, which is what unfavouriting
-- is. There is no update in practice -- the only mutable-looking column is
-- created_at, and it must not move on re-save -- so the app never issues one.
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists shop_ratings_customer_read on public.shop_ratings;
create policy shop_ratings_customer_read on public.shop_ratings for select to authenticated
  using (customer_id = auth.uid());

drop policy if exists comments_read on public.post_comments;
create policy comments_read on public.post_comments for select using (
  exists (select 1 from public.posts p where p.id = post_id and (not p.hidden or public.is_admin()))
);

drop policy if exists comments_insert_own on public.post_comments;
create policy comments_insert_own on public.post_comments for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists comments_update_own on public.post_comments;
create policy comments_update_own on public.post_comments for update
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists comments_delete_own on public.post_comments;
create policy comments_delete_own on public.post_comments for delete
  using (author_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- 12. Grants for tables created by this script
-- -----------------------------------------------------------------------------
-- A table created here starts with no privileges for the anon/authenticated
-- roles, so PostgREST would refuse every request against it until these run.
-- Tables that already existed keep the privileges they had.

grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.vendors, public.menu_items, public.orders,
               public.order_items, public.posts, public.notifications, public.chats
  to anon, authenticated;

grant insert, update on public.profiles, public.vendors, public.menu_items, public.orders,
                        public.order_items, public.posts, public.notifications, public.chats
  to authenticated;

grant delete on public.menu_items, public.orders, public.order_items, public.posts, public.chats
  to authenticated;

-- Identity columns need sequence usage for inserts. The sequence name is
-- resolved from the table so this also works on an existing table whose
-- sequence was named differently.
do $$
declare
  seq record;
begin
  for seq in
    select c.relname as tbl, a.attname as col
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in ('profiles','vendors','menu_items','orders','order_items','posts','notifications','post_comments')
      and pg_get_serial_sequence(format('public.%I', c.relname), a.attname) is not null
  loop
    execute format('grant usage, select on sequence %s to authenticated',
                   pg_get_serial_sequence(format('public.%I', seq.tbl), seq.col));
  end loop;
end $$;

-- post_comments is new in this script and not used by the app yet.
grant select on public.post_comments to anon, authenticated;
grant insert, update, delete on public.post_comments to authenticated;

-- favorites is deliberately absent from the `anon` grants above. A favourites
-- list is a customer's private record, so only the signed-in account may read or
-- write it, and anon has no business seeing one at all.
--
-- No UPDATE, and that is load-bearing rather than tidy. PostgREST implements
-- supabase-js `.upsert()` as INSERT ... ON CONFLICT ... DO UPDATE, and PostgreSQL
-- requires UPDATE privilege on the columns that clause writes -- so a plain
-- `.upsert()` here fails with 42501 permission denied, and because the app treats a
-- failed write as "not yet saved", every heart a customer tapped would sit in
-- localStorage only and be reconciled away on the next reload. The client
-- therefore upserts with `ignoreDuplicates: true`, which PostgREST renders as
-- ON CONFLICT DO NOTHING and which needs INSERT alone. It is also the correct
-- semantics: the conflict target is the whole primary key, so a conflict means the
-- row already exists and is already correct.
grant select, insert, delete on public.favorites to authenticated;

revoke all on public.shop_ratings from anon, authenticated;
grant select on public.shop_ratings to authenticated;

-- -----------------------------------------------------------------------------
-- 13. Storage bucket for post and menu images
-- -----------------------------------------------------------------------------
-- `public` is true so image URLs work in <img src> without a signed link.
--
-- Ownership is decided by the object path, not by an owner column.
-- `uploadMedia()` in src/lib/supabase/media.js always writes
-- `<user uuid>/<folder>/<unique id>.<ext>`, so `(storage.foldername(name))[1]` is
-- the uploader's own id. That is deliberate: `storage.objects.owner_id` is text
-- on Supabase (the uuid column is `owner`), so a policy written as
-- `owner_id = auth.uid()` fails to compile with
-- "operator does not exist: text = uuid" -- and which of the two columns exists
-- differs between storage versions. The path convention is the same in both, and
-- it is the one thing this app actually controls.

insert into storage.buckets (id, name, public)
values ('marketplace-media', 'marketplace-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists marketplace_media_read on storage.objects;
create policy marketplace_media_read on storage.objects for select
  using (bucket_id = 'marketplace-media');

drop policy if exists marketplace_media_insert on storage.objects;
create policy marketplace_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'marketplace-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists marketplace_media_update on storage.objects;
create policy marketplace_media_update on storage.objects for update to authenticated
  using (bucket_id = 'marketplace-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'marketplace-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists marketplace_media_delete on storage.objects;
create policy marketplace_media_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'marketplace-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Supabase Realtime only streams changes from tables in this publication.
-- Keep the order tables and chats published so updates reach open clients
-- immediately.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
    ) then
      alter publication supabase_realtime add table public.orders;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_items'
    ) then
      alter publication supabase_realtime add table public.order_items;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chats'
    ) then
      alter publication supabase_realtime add table public.chats;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_ratings'
    ) then
      alter publication supabase_realtime add table public.shop_ratings;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vendors'
    ) then
      alter publication supabase_realtime add table public.vendors;
    end if;
  else
    raise warning 'supabase_realtime publication is missing; orders, chats and shop ratings will use periodic refresh until Realtime is enabled.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 14. Seed an admin
-- -----------------------------------------------------------------------------
-- Create the user under Authentication > Users first, then uncomment:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';



-- -----------------------------------------------------------------------------
-- 15. Verification report
-- -----------------------------------------------------------------------------
-- Read this after running. Every row must say `ok`.
--
-- expected_type is format_type() of the column as it actually exists, compared
-- against the canonical list. A `TYPE MISMATCH` means the column exists but is
-- the wrong type -- which is the one failure `add column if not exists` can
-- never detect, and which would quietly corrupt money arithmetic.
--
-- The comparison strips `generated by default as identity` from the expected
-- type first. Identity is not part of a column's type: it is a separate
-- attribute, so format_type() reports `bigint` for a column the canonical list
-- spells `bigint generated by default as identity`. Comparing the two strings
-- directly reported a TYPE MISMATCH on all seven identity primary keys of a
-- database that was in fact perfectly correct, and the warning block below then
-- named all seven. The full `typ` is still what section 5 uses to add a missing
-- column, because there the identity clause really is needed.

with expected as (
  select
    e.tbl,
    e.col,
    e.typ,
    regexp_replace(e.typ, '\s+generated by default as identity$', '') as base_typ,
    case when a.attname is null then '(absent)'
         else format_type(a.atttypid, a.atttypmod) end            as actual_type
  from public._canonical_columns e
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c on c.relnamespace = n.oid and c.relname = e.tbl
  left join pg_attribute a on a.attrelid = c.oid and a.attname = e.col
)
select
  tbl                                as table_name,
  col                                as column_name,
  typ                                as expected_type,
  actual_type,
  case
    when actual_type = '(absent)' then 'MISSING'
    when actual_type <> base_typ then 'TYPE MISMATCH'
    else 'ok'
  end                                as status
from expected
order by (case when actual_type = '(absent)' then 0 when actual_type <> base_typ then 1 else 2 end),
         tbl, col;

-- Anything still MISSING or a TYPE MISMATCH, named explicitly. Warnings do not
-- roll back the transaction, so a partial problem is reported rather than
-- silently discarding everything that was applied.
do $$
declare
  bad record;
begin
  for bad in
    select e.tbl, e.col, e.typ
    from public._canonical_columns e
    left join pg_namespace n on n.nspname = 'public'
    left join pg_class c on c.relnamespace = n.oid and c.relname = e.tbl
    left join pg_attribute a on a.attrelid = c.oid and a.attname = e.col
    where a.attname is null
       or format_type(a.atttypid, a.atttypmod)
          <> regexp_replace(e.typ, '\s+generated by default as identity$', '')
  loop
    raise warning '%.% is not as expected (wanted %)', bad.tbl, bad.col, bad.typ;
  end loop;
end $$;

-- RLS must be on everywhere, and no table left readable by the anon key.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  coalesce((select bool_or(p.polpermissive) from pg_policy p where p.polrelid = c.oid), false) as has_permissive_policy
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- Favourites, end to end, in one row. This is the read to run when a heart does
-- not survive a reload: it answers "is the table there, is it keyed the way the
-- client upserts, and can the signed-in role actually reach it" without needing a
-- browser. The post-condition before `commit` already refuses to let the run
-- finish if any of the three is wrong, so a clean run here should read ok = true.
--
-- `favourites_rows` is expected to be 0 on a fresh database and is informational
-- only -- an empty list is a correct state, not a fault.
select
  to_regclass('public.favorites') is not null as table_exists,
  coalesce((
    select (array_agg(a.attname::text order by a.attname) = array['target_legacy_id','target_type','user_id']::text[])
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join unnest(c.conkey) as k(attnum) on true
    join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
    where n.nspname = 'public' and t.relname = 'favorites' and c.contype = 'p'
  ), false) as key_matches_client,
  (select relrowsecurity from pg_class where oid = 'public.favorites'::regclass) as rls_enabled,
  coalesce((
    select string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'favorites' and grantee = 'authenticated'
  ), 'NONE') as authenticated_grants,
  coalesce((
    select string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'favorites' and grantee = 'anon'
  ), 'NONE (correct)') as anon_grants,
  coalesce((
    select string_agg(policyname, ',' order by policyname)
    from pg_policies where schemaname = 'public' and tablename = 'favorites'
  ), 'NONE') as policies,
  (select count(*) from public.favorites) as favourites_rows,
  (
    to_regclass('public.favorites') is not null
    and coalesce((
      select (array_agg(a.attname::text order by a.attname) = array['target_legacy_id','target_type','user_id']::text[])
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(c.conkey) as k(attnum) on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
      where n.nspname = 'public' and t.relname = 'favorites' and c.contype = 'p'
    ), false)
    and exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'favorites'
        and grantee = 'authenticated' and lower(privilege_type) in ('select', 'insert')
    )
  ) as ok;


select
  count(*) filter (where table_name = 'vendors' and column_name in ('delivery_fee','free_delivery','min_order')) as vendor_fee_columns_left,
  count(*) filter (where table_name = 'orders'  and column_name in ('subtotal','delivery_fee','discount'))        as order_amount_columns_left
from information_schema.columns
where table_schema = 'public';


select 'vendors' as table_name, count(*) as fractional_ids_left
  from public.vendors where legacy_id is not null and legacy_id <> round(legacy_id)
union all select 'menu_items', count(*) from public.menu_items where legacy_id is not null and legacy_id <> round(legacy_id)
union all select 'orders', count(*) from public.orders where vendor_legacy_id is not null and vendor_legacy_id <> round(vendor_legacy_id)
union all select 'order_items', count(*) from public.order_items where menu_legacy_id is not null and menu_legacy_id <> round(menu_legacy_id)
union all select 'posts', count(*) from public.posts where legacy_id is not null and legacy_id <> round(legacy_id)
union all select 'notifications', count(*) from public.notifications where legacy_id is not null and legacy_id <> round(legacy_id)
union all select 'chats', count(*) from public.chats where vendor_legacy_id is not null and vendor_legacy_id <> round(vendor_legacy_id)
order by 1;

-- Every id the app upserts on must still be unique, or the next write fails
-- with 23505 / 42P10 instead of updating the intended row.
select 'vendors.legacy_id' as unique_index, count(*) as duplicate_groups from (
  select legacy_id from public.vendors where legacy_id is not null group by legacy_id having count(*) > 1
) d
union all select 'menu_items(vendor,legacy)', count(*) from (
  select vendor_id, legacy_id from public.menu_items group by vendor_id, legacy_id having count(*) > 1
) d
union all select 'posts.legacy_id', count(*) from (
  select legacy_id from public.posts where legacy_id is not null group by legacy_id having count(*) > 1
) d
union all select 'notifications(user_id,legacy_id)', count(*) from (
  select user_id, legacy_id from public.notifications where legacy_id is not null
  group by user_id, legacy_id having count(*) > 1
) d
union all select 'order_items(order,menu,notes)', count(*) from (
  select order_id, menu_legacy_id, notes from public.order_items
  where menu_legacy_id is not null
  group by order_id, menu_legacy_id, notes having count(*) > 1
) d
order by 1;

select
  'notify_admin_desk(bigint,text,text,text)' as expected_signature,
  case
    when not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'notify_admin_desk'
    ) then 'MISSING -- admin alerts will not be delivered'
    when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'notify_admin_desk'
        and pg_get_function_identity_arguments(p.oid) = 'text, text'
    ) then 'STALE 2-ARG VERSION STILL PRESENT'
    when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'notify_admin_desk'
        and pg_get_function_identity_arguments(p.oid) = 'bigint, text, text, text'
    ) then 'ok'
    else 'UNEXPECTED SIGNATURE'
  end as status,
  (
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'notify_admin_desk'
  ) as overloads,
  -- A real dedupe needs the recipient-scoped unique key used by both writers.
  case when exists (
    select 1 from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'notifications'
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%(user_id, legacy_id)%'
  ) then 'ok' else 'MISSING UNIQUE (user_id, legacy_id) -- alerts may not be delivered' end as dedupes;

select
  'profiles account-role/status guard' as check_name,
  case when exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and t.tgname = 'profiles_protect_account_fields' and not t.tgisinternal
  ) then 'ok' else 'MISSING -- users may change their own account role or status' end as status;

select
  'marketplace-media' as bucket,
  case
    when not exists (
      select 1 from storage.buckets where id = 'marketplace-media'
    ) then 'MISSING -- every image upload will fail'
    when not exists (
      select 1 from storage.buckets where id = 'marketplace-media' and public
    ) then 'NOT PUBLIC -- recipients cannot render the image'
    else 'ok'
  end as status,
  (
    select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'marketplace_media_read', 'marketplace_media_insert',
        'marketplace_media_update', 'marketplace_media_delete'
      )
  ) as policies_present,
  case when (
    select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'marketplace_media_read', 'marketplace_media_insert',
        'marketplace_media_update', 'marketplace_media_delete'
      )
  ) = 4 then 'ok' else 'INCOMPLETE -- rerun section 13' end as policies;




  drop table if exists public._canonical_columns;


do $$
declare
  f_exists boolean;
  f_pk text;
  f_grants text;
  ratings_exists boolean;
  ratings_rls boolean;
  ratings_rpc boolean;
  ratings_order_key boolean;
  notification_key boolean;
  order_item_key boolean;
begin
  select to_regclass('public.favorites') is not null into f_exists;

  if not f_exists then
    raise exception
      'schema.sql did not create public.favorites. The app cannot read or write a '
      'favourites list without it. Nothing has been committed -- re-run the whole '
      'file, and check for an earlier error in the output above.';
  end if;

  select array_agg(a.attname::text order by a.attname) into f_pk
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  join unnest(c.conkey) as k(attnum) on true
  join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
  where n.nspname = 'public' and t.relname = 'favorites' and c.contype = 'p';

  if f_pk is distinct from '{target_legacy_id,target_type,user_id}' then
    raise exception
      'public.favorites has the wrong primary key (got: %). The client upserts on '
      'user_id, target_type, target_legacy_id and PostgREST rejects an ON CONFLICT '
      'target with no matching unique index (42P10). Nothing has been committed -- '
      'find and drop the rows or columns blocking the constraint, then re-run.',
      coalesce(f_pk, 'none');
  end if;

  select string_agg(privilege_type, ',' order by privilege_type) into f_grants
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'favorites'
    and grantee = 'authenticated';

  -- privilege_type is reported upper-case by information_schema, and LIKE is
  -- case-sensitive, so the match is lower-cased on both sides. It used to read
  -- like '%insert%' against a value that is always 'INSERT', so this guard
  -- rejected a correctly granted table and aborted the whole run.
  if f_grants is null or not (f_grants ilike '%insert%' and f_grants ilike '%select%') then
    raise exception
      'public.favorites is missing grants for the authenticated role (got: %). The '
      'client needs select and insert at minimum. Nothing has been committed.',
      coalesce(f_grants, 'none');
  end if;

  select exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'notifications'
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%(user_id, legacy_id)%'
  ) into notification_key;

  if not notification_key then
    raise exception
      'public.notifications is missing its unique (user_id, legacy_id) key. '
      'Admin alerts cannot be delivered once per admin. Resolve duplicate rows '
      'and re-run supabase/schema.sql. Nothing has been committed.';
  end if;

  select exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'order_items'
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%(order_id, menu_legacy_id, notes)%'
  ) into order_item_key;

  if not order_item_key then
    raise exception
      'public.order_items is missing its unique (order_id, menu_legacy_id, notes) key. '
      'The order item upsert can duplicate or overwrite customized lines. Resolve '
      'duplicate rows and re-run supabase/schema.sql. Nothing has been committed.';
  end if;

  select to_regclass('public.shop_ratings') is not null into ratings_exists;
  if not ratings_exists then
    raise exception
      'schema.sql did not create public.shop_ratings. Completed-order ratings cannot be saved. '
      'Nothing has been committed -- re-run the whole file and check for an earlier error.';
  end if;

  select relrowsecurity into ratings_rls
  from pg_class where oid = 'public.shop_ratings'::regclass;
  if not ratings_rls then
    raise exception
      'public.shop_ratings must have row level security enabled. Nothing has been committed.';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shop_ratings'
      and policyname = 'shop_ratings_customer_read'
  ) then
    raise exception
      'public.shop_ratings is missing its customer-only read policy. Nothing has been committed.';
  end if;
  select exists (
    select 1 from pg_index i
    where i.indrelid = 'public.shop_ratings'::regclass
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%(order_number)%'
  ) into ratings_order_key;
  if not ratings_order_key then
    raise exception
      'public.shop_ratings is missing its unique order_number key, so one-rating-per-order cannot be enforced. '
      'Nothing has been committed.';
  end if;
  if has_table_privilege('authenticated', 'public.shop_ratings', 'INSERT')
     or has_table_privilege('authenticated', 'public.shop_ratings', 'UPDATE')
     or has_table_privilege('authenticated', 'public.shop_ratings', 'DELETE') then
    raise exception
      'authenticated must not write shop_ratings directly; writes go through rate_completed_order. '
      'Nothing has been committed.';
  end if;
  select has_function_privilege(
    'authenticated', 'public.rate_completed_order(text,integer)', 'EXECUTE'
  ) and not has_function_privilege(
    'anon', 'public.rate_completed_order(text,integer)', 'EXECUTE'
  ) into ratings_rpc;
  if not ratings_rpc then
    raise exception
      'rate_completed_order must be executable by authenticated and unavailable to anon. '
      'Nothing has been committed.';
  end if;

  raise notice 'post-condition ok: public.favorites exists, keyed (%), grants: %',
    f_pk, f_grants;
  raise notice 'post-condition ok: public.shop_ratings is private and writes require rate_completed_order';
end $$;

commit;
