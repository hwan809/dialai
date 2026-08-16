create extension if not exists pgcrypto;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key_prefix text not null check (char_length(key_prefix) = 12),
  key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.phone_call_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  destination_phone text not null,
  objective text not null check (char_length(objective) between 1 and 1000),
  context text check (context is null or char_length(context) <= 2000),
  success_criteria jsonb check (
    success_criteria is null
    or (jsonb_typeof(success_criteria) = 'array' and jsonb_array_length(success_criteria) <= 10)
  ),
  status text not null default 'queued' check (status in (
    'queued', 'dialing', 'connected', 'retry_scheduled', 'completed', 'needs_human', 'failed', 'canceled'
  )),
  attempt_count integer not null default 0 check (attempt_count between 0 and 2),
  next_attempt_at timestamptz default now(),
  locked_by text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  outcome jsonb,
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  last_failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (tenant_id, idempotency_key)
);

create index phone_call_jobs_claim_idx
  on public.phone_call_jobs (next_attempt_at, created_at)
  where status in ('queued', 'retry_scheduled') and attempt_count < 2;

create index phone_call_jobs_tenant_created_idx
  on public.phone_call_jobs (tenant_id, created_at desc);

create table public.phone_call_attempts (
  id uuid primary key default gen_random_uuid(),
  phone_call_job_id uuid not null references public.phone_call_jobs(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 2),
  provider_call_id text unique,
  status text not null,
  answered_by text,
  hangup_cause text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (phone_call_job_id, attempt_number)
);

alter table public.tenants enable row level security;
alter table public.api_keys enable row level security;
alter table public.phone_call_jobs enable row level security;
alter table public.phone_call_attempts enable row level security;

revoke all on table public.tenants, public.api_keys, public.phone_call_jobs, public.phone_call_attempts
  from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.tenants, public.api_keys, public.phone_call_jobs, public.phone_call_attempts
  to service_role;

create or replace function public.claim_next_phone_call(p_worker_id text)
returns setof public.phone_call_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id
    from public.phone_call_jobs
    where status in ('queued', 'retry_scheduled')
      and next_attempt_at <= now()
      and attempt_count < 2
    order by next_attempt_at, created_at
    for update skip locked
    limit 1
  )
  update public.phone_call_jobs job
  set status = 'dialing',
      attempt_count = job.attempt_count + 1,
      next_attempt_at = null,
      locked_by = p_worker_id,
      locked_at = now(),
      heartbeat_at = now(),
      updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
end;
$$;

create or replace function public.append_phone_call_transcript(
  p_job_id uuid,
  p_segment jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.phone_call_jobs
  set transcript = transcript || jsonb_build_array(p_segment),
      updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.fail_or_retry_phone_call(
  p_job_id uuid,
  p_reason text,
  p_retry_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.phone_call_jobs
  set status = case
        when p_retry_at is not null and attempt_count < 2 then 'retry_scheduled'
        else 'failed'
      end,
      next_attempt_at = case
        when p_retry_at is not null and attempt_count < 2 then p_retry_at
        else null
      end,
      last_failure_reason = p_reason,
      locked_by = null,
      locked_at = null,
      heartbeat_at = null,
      updated_at = now(),
      completed_at = case
        when p_retry_at is not null and attempt_count < 2 then null
        else now()
      end
  where id = p_job_id;
end;
$$;

create or replace function public.recover_stale_phone_calls(p_stale_before timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_count integer;
begin
  update public.phone_call_jobs
  set status = case when attempt_count < 2 then 'retry_scheduled' else 'failed' end,
      next_attempt_at = case when attempt_count < 2 then now() else null end,
      last_failure_reason = 'worker heartbeat timed out',
      locked_by = null,
      locked_at = null,
      heartbeat_at = null,
      updated_at = now(),
      completed_at = case when attempt_count < 2 then null else now() end
  where status in ('dialing', 'connected')
    and heartbeat_at < p_stale_before;

  get diagnostics recovered_count = row_count;
  return recovered_count;
end;
$$;

revoke all on function public.claim_next_phone_call(text) from public, anon, authenticated;
revoke all on function public.append_phone_call_transcript(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_or_retry_phone_call(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.recover_stale_phone_calls(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_next_phone_call(text) to service_role;
grant execute on function public.append_phone_call_transcript(uuid, jsonb) to service_role;
grant execute on function public.fail_or_retry_phone_call(uuid, text, timestamptz) to service_role;
grant execute on function public.recover_stale_phone_calls(timestamptz) to service_role;
