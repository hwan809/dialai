alter table public.tenants
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

-- An early pre-release of 202608160001 added this required column. Remove it
-- here so upgraded databases accept hash-only API key inserts as well.
alter table public.api_keys
  drop column if exists key_prefix;

create unique index if not exists tenants_owner_user_id_unique
  on public.tenants (owner_user_id);

create or replace function public.rotate_mcp_api_key(
  p_owner_user_id uuid,
  p_tenant_name text,
  p_key_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_tenant_id uuid;
begin
  if p_owner_user_id is null then
    raise exception 'owner user id is required';
  end if;
  if char_length(trim(p_tenant_name)) not between 1 and 100 then
    raise exception 'tenant name must contain 1 to 100 characters';
  end if;
  if p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid key hash';
  end if;

  insert into public.tenants (name, owner_user_id)
  values (trim(p_tenant_name), p_owner_user_id)
  on conflict (owner_user_id) do update
    set name = excluded.name
  returning id into selected_tenant_id;

  update public.api_keys
  set revoked_at = now()
  where tenant_id = selected_tenant_id
    and revoked_at is null;

  insert into public.api_keys (tenant_id, key_hash)
  values (selected_tenant_id, p_key_hash);

  return selected_tenant_id;
end;
$$;

revoke all on function public.rotate_mcp_api_key(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.rotate_mcp_api_key(uuid, text, text)
  to service_role;
