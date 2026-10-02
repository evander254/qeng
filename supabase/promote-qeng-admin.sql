-- Run once in Supabase SQL Editor after creating the Qeng Auth user.
-- The database owner executing this statement promotes Qeng to the system administrator.
update public.profiles
set role = 'admin',
    approved_at = coalesce(approved_at, now())
where lower(trim(username)) = 'qeng';

do $$
begin
  if not exists (
    select 1 from public.profiles
    where lower(trim(username)) = 'qeng' and role = 'admin' and approved_at is not null
  ) then
    raise exception 'Qeng profile not found or could not be promoted. Check the Qeng Auth user and profile username.';
  end if;
end $$;
