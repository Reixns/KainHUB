-- Add role-specific personal profiles without breaking clients that still read
-- and write the compatibility fields on public.profiles.
begin;

create table if not exists public.customer_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  full_name text,
  mobile text,
  address text,
  avatar text,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  full_name text,
  mobile text,
  address text,
  avatar text,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  full_name text,
  mobile text,
  address text,
  avatar text,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  '[ALL PORTALS] Shared Auth account registry: identity, role and status. Personal details are maintained in the matching role profile table; legacy detail columns are mirrored for older clients.';
comment on table public.customer_profiles is
  '[CUSTOMER PORTAL] Customer personal profile details. id is the Auth account UUID and references profiles.id.';
comment on table public.vendor_profiles is
  '[VENDOR PORTAL] Vendor personal profile details. Shop/business settings remain in vendors; id references profiles.id.';
comment on table public.admin_profiles is
  '[ADMIN PORTAL] Admin personal profile details. id is the Auth account UUID and references profiles.id.';

create or replace function public.sync_role_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    if old.role = 'customer' then
      delete from public.customer_profiles where id = old.id;
    elsif old.role = 'vendor' then
      delete from public.vendor_profiles where id = old.id;
    elsif old.role = 'admin' then
      delete from public.admin_profiles where id = old.id;
    end if;
  end if;

  if new.role = 'customer' then
    insert into public.customer_profiles (id, full_name, mobile, address, avatar, cover_image, created_at, updated_at)
    values (new.id, new.full_name, new.mobile, new.address, new.avatar, new.cover_image, new.created_at, new.updated_at)
    on conflict (id) do update set
      full_name = excluded.full_name,
      mobile = excluded.mobile,
      address = excluded.address,
      avatar = excluded.avatar,
      cover_image = excluded.cover_image,
      updated_at = excluded.updated_at;
  elsif new.role = 'vendor' then
    insert into public.vendor_profiles (id, full_name, mobile, address, avatar, cover_image, created_at, updated_at)
    values (new.id, new.full_name, new.mobile, new.address, new.avatar, new.cover_image, new.created_at, new.updated_at)
    on conflict (id) do update set
      full_name = excluded.full_name,
      mobile = excluded.mobile,
      address = excluded.address,
      avatar = excluded.avatar,
      cover_image = excluded.cover_image,
      updated_at = excluded.updated_at;
  elsif new.role = 'admin' then
    insert into public.admin_profiles (id, full_name, mobile, address, avatar, cover_image, created_at, updated_at)
    values (new.id, new.full_name, new.mobile, new.address, new.avatar, new.cover_image, new.created_at, new.updated_at)
    on conflict (id) do update set
      full_name = excluded.full_name,
      mobile = excluded.mobile,
      address = excluded.address,
      avatar = excluded.avatar,
      cover_image = excluded.cover_image,
      updated_at = excluded.updated_at;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_role_profile() from public, anon, authenticated;

drop trigger if exists profiles_sync_role_profile on public.profiles;
create trigger profiles_sync_role_profile
  after insert or update of role, full_name, mobile, address, avatar, cover_image
  on public.profiles
  for each row execute function public.sync_role_profile();

insert into public.customer_profiles (id, full_name, mobile, address, avatar, cover_image, created_at, updated_at)
select id, full_name, mobile, address, avatar, cover_image, created_at, updated_at
from public.profiles
where role = 'customer'
on conflict (id) do update set
  full_name = coalesce(nullif(public.customer_profiles.full_name, ''), excluded.full_name),
  mobile = coalesce(nullif(public.customer_profiles.mobile, ''), excluded.mobile),
  address = coalesce(nullif(public.customer_profiles.address, ''), excluded.address),
  avatar = coalesce(nullif(public.customer_profiles.avatar, ''), excluded.avatar),
  cover_image = coalesce(nullif(public.customer_profiles.cover_image, ''), excluded.cover_image),
  updated_at = greatest(public.customer_profiles.updated_at, excluded.updated_at);

insert into public.vendor_profiles (id, full_name, mobile, address, avatar, cover_image, created_at, updated_at)
select id, full_name, mobile, address, avatar, cover_image, created_at, updated_at
from public.profiles
where role = 'vendor'
on conflict (id) do update set
  full_name = coalesce(nullif(public.vendor_profiles.full_name, ''), excluded.full_name),
  mobile = coalesce(nullif(public.vendor_profiles.mobile, ''), excluded.mobile),
  address = coalesce(nullif(public.vendor_profiles.address, ''), excluded.address),
  avatar = coalesce(nullif(public.vendor_profiles.avatar, ''), excluded.avatar),
  cover_image = coalesce(nullif(public.vendor_profiles.cover_image, ''), excluded.cover_image),
  updated_at = greatest(public.vendor_profiles.updated_at, excluded.updated_at);

insert into public.admin_profiles (id, full_name, mobile, address, avatar, cover_image, created_at, updated_at)
select id, full_name, mobile, address, avatar, cover_image, created_at, updated_at
from public.profiles
where role = 'admin'
on conflict (id) do update set
  full_name = coalesce(nullif(public.admin_profiles.full_name, ''), excluded.full_name),
  mobile = coalesce(nullif(public.admin_profiles.mobile, ''), excluded.mobile),
  address = coalesce(nullif(public.admin_profiles.address, ''), excluded.address),
  avatar = coalesce(nullif(public.admin_profiles.avatar, ''), excluded.avatar),
  cover_image = coalesce(nullif(public.admin_profiles.cover_image, ''), excluded.cover_image),
  updated_at = greatest(public.admin_profiles.updated_at, excluded.updated_at);

alter table public.customer_profiles enable row level security;
alter table public.vendor_profiles enable row level security;
alter table public.admin_profiles enable row level security;

drop policy if exists customer_profiles_read on public.customer_profiles;
create policy customer_profiles_read on public.customer_profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.customer_id = customer_profiles.id and o.vendor_owner_id = auth.uid()
  )
  or exists (
    select 1 from public.chats c
    join public.vendors v on (v.legacy_id = c.vendor_legacy_id or v.id = c.vendor_legacy_id)
    where c.customer_id = customer_profiles.id and v.owner_id = auth.uid()
  )
);

drop policy if exists customer_profiles_insert_own on public.customer_profiles;
create policy customer_profiles_insert_own on public.customer_profiles for insert
  with check (
    public.is_admin()
    or (customer_profiles.id = auth.uid() and exists (
      select 1 from public.profiles p where p.id = customer_profiles.id and p.role = 'customer'
    ))
  );

drop policy if exists customer_profiles_update_own on public.customer_profiles;
create policy customer_profiles_update_own on public.customer_profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (customer_profiles.id = auth.uid() and exists (
      select 1 from public.profiles p where p.id = customer_profiles.id and p.role = 'customer'
    ))
  );

drop policy if exists vendor_profiles_read_own on public.vendor_profiles;
create policy vendor_profiles_read_own on public.vendor_profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists vendor_profiles_insert_own on public.vendor_profiles;
create policy vendor_profiles_insert_own on public.vendor_profiles for insert
  with check (
    public.is_admin()
    or (vendor_profiles.id = auth.uid() and exists (
      select 1 from public.profiles p where p.id = vendor_profiles.id and p.role = 'vendor'
    ))
  );

drop policy if exists vendor_profiles_update_own on public.vendor_profiles;
create policy vendor_profiles_update_own on public.vendor_profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (vendor_profiles.id = auth.uid() and exists (
      select 1 from public.profiles p where p.id = vendor_profiles.id and p.role = 'vendor'
    ))
  );

drop policy if exists admin_profiles_read_own on public.admin_profiles;
create policy admin_profiles_read_own on public.admin_profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists admin_profiles_insert_own on public.admin_profiles;
create policy admin_profiles_insert_own on public.admin_profiles for insert
  with check (
    public.is_admin()
    or (admin_profiles.id = auth.uid() and exists (
      select 1 from public.profiles p where p.id = admin_profiles.id and p.role = 'admin'
    ))
  );

drop policy if exists admin_profiles_update_own on public.admin_profiles;
create policy admin_profiles_update_own on public.admin_profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (admin_profiles.id = auth.uid() and exists (
      select 1 from public.profiles p where p.id = admin_profiles.id and p.role = 'admin'
    ))
  );

revoke all on public.customer_profiles, public.vendor_profiles, public.admin_profiles
  from anon, public;
grant select, insert, update on public.customer_profiles, public.vendor_profiles, public.admin_profiles
  to authenticated;

notify pgrst, 'reload schema';
commit;
