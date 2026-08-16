# DialAI

DialAI queues a general-purpose Korean phone call from an MCP client, then an always-on worker places the call and saves the transcript and verified outcome. It supports information inquiries, reservations, changes, and cancellations; it does not keep the MCP request open while telephony runs.

## Local setup and Supabase

```bash
npm install
cp .env.example .env.local
```

Create a Supabase project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and apply every SQL migration in `supabase/migrations/` in filename order. The first migration creates the durable phone-call queue; the second links tenants to Supabase Auth users and adds transactional MCP-key rotation. For server and worker access, prefer `SUPABASE_SECRET_KEY`; `SUPABASE_SERVICE_ROLE_KEY` is a legacy fallback only. Neither server key belongs in a `NEXT_PUBLIC_` variable. Local scripts automatically read `.env.local` when it exists.

Create a tenant and its MCP bearer token after configuring the Supabase environment:

```bash
npm run tenant:create -- --name "Example tenant"
```

The raw `call_...` token is shown once. Store it in a secret manager; the database stores only its SHA-256 hash.

## Hosted deployment: no user-side worker

Users run only Codex. DialAI operates two deployment processes against the same Supabase project:

```bash
# Public Next.js web/MCP service, for example on Vercel
npm run build && npm run start

# Always-on Node worker on a container host
docker build -f Dockerfile.worker -t dialai-worker .
docker run --env-file .env.local dialai-worker
```

`railway.worker.json` is provided for a separate Railway worker service. Because this is intentionally not the auto-discovered `railway.json`, set that service's **Config File** setting to `railway.worker.json`; do not set it on the public web service. Set `DIALAI_PUBLIC_URL` on the web service. Set the Supabase server key plus `CLAWOPS_API_KEY`, `CLAWOPS_ACCOUNT_ID`, `CLAWOPS_FROM_NUMBER`, and `OPENAI_API_KEY` on the worker. The worker atomically claims one job at a time, heartbeats active work every 30 seconds, recovers locks stale for five minutes, and retries only one `no-answer`, `busy`, or transient provider failure.

## Main-page MCP installation contract

The frontend must obtain a Supabase Auth session, then request a tenant-scoped key:

```ts
const response = await fetch("/api/mcp/install", {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.access_token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ tenantName: "My DialAI" }),
});
const { installCommand, mcpUrl } = await response.json();
```

The `201` response contains `{ mcpUrl, installCommand }` and is marked `Cache-Control: no-store`. Show `installCommand` once in a copy button; it is the only place the raw key appears. Issuing another key revokes the user's previous key; Postgres stores only the new SHA-256 hash.

## Codex MCP registration

For hosted onboarding, copy and run the returned `installCommand`. It requires only Codex plus ordinary shell tooling: it replaces the DialAI registration, verifies the exact hosted readiness response, and starts Codex only after that check succeeds. Do not save the command or its exported bearer token in the repository or Codex configuration file.

## Operator-only repository diagnostics

Maintainers with this repository may run the full MCP tool-set diagnostic:

```bash
DIALAI_MCP_URL=https://example.com/mcp DIALAI_MCP_TOKEN='call_...' npm run mcp:check
```

This is not part of end-user hosted onboarding. If the DialAI tools are unavailable, report the connection failure and do not create a shell script that calls ClawOps directly.

For local development, replace the URL with `http://localhost:3000/mcp`. DialAI exposes these generic tools:

- `create_phone_call` — queue a call with `destinationPhone`, a free-form `objective`, optional `context`, and optional `successCriteria`.
- `get_phone_call` — retrieve a queued call, transcript, and outcome.
- `list_phone_calls` — list recent calls for the authenticated tenant.
- `cancel_phone_call` — cancel only queued or retry-scheduled calls.

`create_phone_call` returns a `callId` and queued status immediately. Poll `get_phone_call` for completion rather than waiting for a call in the MCP session.

## Environment and security

`CLAWOPS_API_KEY`, `CLAWOPS_ACCOUNT_ID`, `CLAWOPS_FROM_NUMBER`, and `OPENAI_API_KEY` are server/worker secrets. The worker always uses `CLAWOPS_FROM_NUMBER`; MCP clients cannot select caller ID. Logs redact destinations to their last four digits and never print secrets, full context, or full phone numbers.

The ClawOps agent uses Korean OpenAI Realtime, does not record audio, identifies itself as an AI assistant in its first turn, and records only text transcript plus confirmed facts. Realtime prewarm is disabled because a pre-answer session can invoke outcome or hang-up tools before the callee answers. The prompt uses DTMF for relevant ARS routing and never leaves personal data or callback numbers in voicemail. Do not commit `.env.local`, bearer tokens, Supabase secret keys, ClawOps credentials, or OpenAI credentials.

## Safe live smoke call

Automated tests never place a telephone call. The smoke command refuses to run unless both values are explicitly supplied:

```bash
RUN_LIVE_CALL=true LIVE_CALL_TO=01000000000 npm run smoke:call
```

Set `LIVE_CALL_OBJECTIVE` and `LIVE_CALL_CONTEXT` when you want to exercise a specific scenario. Use only a number whose owner has approved the test. The command normalizes that explicit number, performs exactly one call, redacts its final output, and disconnects after the call.

## Verification

```bash
npm test
npm run lint
npm run build
```
