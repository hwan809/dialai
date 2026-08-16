# DialAI

DialAI queues a general-purpose Korean phone call from an MCP client, then an always-on worker places the call and saves the transcript and verified outcome. It supports information inquiries, reservations, changes, and cancellations; it does not keep the MCP request open while telephony runs.

## Local setup and Supabase

```bash
npm install
cp .env.example .env.local
```

Create a Supabase project, set `NEXT_PUBLIC_SUPABASE_URL`, and apply the SQL migration in `supabase/migrations/` to create the tenant, API-key, phone-call-job, and call-attempt tables plus their queue RPCs. For server and worker access, prefer `SUPABASE_SECRET_KEY`; `SUPABASE_SERVICE_ROLE_KEY` is a legacy fallback only. Neither key belongs in a `NEXT_PUBLIC_` variable.

Create a tenant and its MCP bearer token after configuring the Supabase environment:

```bash
npm run tenant:create -- --name "Example tenant"
```

The raw `call_...` token is shown once. Store it in a secret manager; the database stores only its SHA-256 hash.

## Two deployment processes

Deploy these as separate processes:

```bash
# Next.js MCP server (Vercel or another Node host)
npm run dev

# Always-on Node worker; never run this in a Vercel Route Handler
npm run worker
```

The worker atomically claims one job at a time, heartbeats active work every 30 seconds, recovers locks stale for five minutes, and retries only one `no-answer`, `busy`, or transient provider failure. Add worker processes only after the ClawOps account supports the corresponding concurrent phone lines.

## Codex MCP registration

Set the bearer token in your shell, not in the repository or Codex configuration file:

```bash
export DIALAI_MCP_TOKEN='call_...'
codex mcp add dialai --url https://example.com/mcp --bearer-token-env-var DIALAI_MCP_TOKEN
codex mcp list
```

For local development, replace the URL with `http://localhost:3000/mcp`. DialAI exposes these generic tools:

- `create_phone_call` — queue a call with `destinationPhone`, a free-form `objective`, optional `context`, and optional `successCriteria`.
- `get_phone_call` — retrieve a queued call, transcript, and outcome.
- `list_phone_calls` — list recent calls for the authenticated tenant.
- `cancel_phone_call` — cancel only queued or retry-scheduled calls.

`create_phone_call` returns a `callId` and queued status immediately. Poll `get_phone_call` for completion rather than waiting for a call in the MCP session.

## Environment and security

`CLAWOPS_API_KEY`, `CLAWOPS_ACCOUNT_ID`, `CLAWOPS_FROM_NUMBER`, and `OPENAI_API_KEY` are server/worker secrets. The worker always uses `CLAWOPS_FROM_NUMBER`; MCP clients cannot select caller ID. Logs redact destinations to their last four digits and never print secrets, full context, or full phone numbers.

The ClawOps agent uses Korean OpenAI Realtime, does not record audio, identifies itself as an AI assistant in its first turn, and records only text transcript plus confirmed facts. Do not commit `.env.local`, bearer tokens, Supabase secret keys, ClawOps credentials, or OpenAI credentials.

## Safe live smoke call

Automated tests never place a telephone call. The smoke command refuses to run unless both values are explicitly supplied:

```bash
RUN_LIVE_CALL=true LIVE_CALL_TO=01000000000 npm run smoke:call
```

Use only a number whose owner has approved the test. The command normalizes that explicit number, performs one short connection check, redacts its final output, and disconnects after the call.

## Verification

```bash
npm test
npm run lint
npm run build
```
