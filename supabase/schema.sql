-- VOSKI database schema. Run in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (username)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  course_code text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);
alter table public.classes add column if not exists end_date date;

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  task text not null,
  due_date date,
  status text not null default 'Unfinished',
  estimated_hours numeric(6,2) not null default 0,
  priority text not null default 'UPCOMING' check (priority in ('OVERDUE','URGENT','UPCOMING')),
  created_at timestamptz not null default now()
);
create index if not exists assignments_owner_due_idx on public.assignments(owner_id, due_date);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, email)
  values (new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1)),
    new.email);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Lets the login form resolve a username to its Auth email before password sign-in.
-- Keep usernames non-sensitive; this intentionally makes account email lookup possible.
create or replace function public.lookup_login_email(username_input text)
returns text language sql stable security definer set search_path = '' as $$
  select email from public.profiles
  where lower(username) = lower(trim(username_input))
  limit 1;
$$;
revoke all on function public.lookup_login_email(text) from public;
grant execute on function public.lookup_login_email(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.assignments enable row level security;

drop policy if exists "Read own or admin profiles" on public.profiles;
create policy "Read own or admin profiles" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "Admins approve profiles" on public.profiles;
create policy "Admins approve profiles" on public.profiles for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Read assigned students" on public.students;
create policy "Read assigned students" on public.students for select to authenticated
using ((owner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved_at is not null)) or (select public.is_admin()));
drop policy if exists "Admins manage students" on public.students;
create policy "Admins manage students" on public.students for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Read assigned classes" on public.classes;
create policy "Read assigned classes" on public.classes for select to authenticated
using ((owner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved_at is not null)) or (select public.is_admin()));
drop policy if exists "Admins manage classes" on public.classes;
create policy "Admins manage classes" on public.classes for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Read assigned work" on public.assignments;
create policy "Read assigned work" on public.assignments for select to authenticated
using ((owner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved_at is not null)) or (select public.is_admin()));
drop policy if exists "Admins manage assignments" on public.assignments;
create policy "Admins manage assignments" on public.assignments for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Owners update assignment progress" on public.assignments;
create policy "Owners update assignment progress" on public.assignments for update to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved_at is not null))
with check (owner_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.students, public.classes, public.assignments to authenticated;
-- Account holders may change progress only. Admins can still manage all fields through their admin policy.
revoke update on public.assignments from authenticated;
grant update (status) on public.assignments to authenticated;

-- Qeng is the designated bootstrap administrator for this installation.
-- Safe to re-run after the Qeng Auth account/profile has been created.
update public.profiles
set role = 'admin', approved_at = coalesce(approved_at, now())
where lower(trim(username)) = 'qeng';
