# MCP Reservation Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant-isolated Streamable HTTP MCP server that durably queues reservation calls and exposes create, get, list, and cancel tools without waiting for a phone call.

**Architecture:** A Next.js 16 App Router Route Handler authenticates a bearer API key, creates a per-request stateless MCP server, and delegates to a reservation service. The service writes to Supabase Postgres, whose `reservation_jobs` table doubles as the durable queue consumed by the later voice-worker plan.

**Tech Stack:** Next.js 16.3.1, TypeScript 5, `@modelcontextprotocol/server` 2.0.0, `@modelcontextprotocol/client` 2.0.0, Zod 4.4.3, Supabase JS 2.112.3, Vitest

**Spec:** `docs/superpowers/specs/2026-08-16-mcp-reservation-calling-design.md`

## Global Constraints

- Use Node.js 20 or newer.
- Keep the MCP endpoint stateless and return from `create_reservation_call` before telephony begins.
- Use Next.js 16.3.1 App Router Route Handlers and Web `Request`/`Response`; do not introduce Pages API routes.
- Use a service-owned 070 number later; never accept a caller-ID field from MCP clients.
- Every repository operation initiated by MCP must include `tenantId`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, ClawOps credentials, or OpenAI credentials through a `NEXT_PUBLIC_` variable.
- Store only API-key hashes, never raw API keys.
- Do not modify the current landing page in this plan.

---

### Task 1: Test Harness and Reservation Contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.mts`
- Create: `src/features/reservations/schema.ts`
- Create: `src/features/reservations/types.ts`
- Test: `src/features/reservations/schema.test.ts`

**Interfaces:**
- Produces: `CreateReservationInput`, `ReservationStatus`, `ReservationOutcome`, `ReservationJob`, `createReservationInputSchema`, `normalizeKoreanPhoneNumber`
- Consumes: none

- [ ] **Step 1: Install the exact runtime and test dependencies**

Run:

```bash
npm install @modelcontextprotocol/server@2.0.0 @modelcontextprotocol/client@2.0.0 zod@4.4.3
npm install --save-dev vitest vite-tsconfig-paths
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Configure Vitest for server-side TypeScript tests**

Create `vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    clearMocks: true,
  },
});
```

- [ ] **Step 3: Write failing schema tests**

Create `src/features/reservations/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createReservationInputSchema,
  normalizeKoreanPhoneNumber,
} from "./schema";

const valid = {
  idempotencyKey: "demo-request-001",
  destinationPhone: "02-1234-5678",
  placeName: "코덱스 식당",
  customerName: "홍길동",
  partySize: 2,
  requestedAt: "2026-08-17T19:00:00+09:00",
  requestNotes: "창가 자리 선호",
};

describe("createReservationInputSchema", () => {
  it("accepts a timezone-qualified request", () => {
    expect(createReservationInputSchema.parse(valid).requestedAt).toBe(valid.requestedAt);
  });

  it("rejects a timestamp without timezone", () => {
    expect(() =>
      createReservationInputSchema.parse({ ...valid, requestedAt: "2026-08-17T19:00:00" }),
    ).toThrow();
  });

  it("rejects party sizes outside 1 through 20", () => {
    expect(() => createReservationInputSchema.parse({ ...valid, partySize: 21 })).toThrow();
  });
});

describe("normalizeKoreanPhoneNumber", () => {
  it("removes separators but preserves the domestic leading zero", () => {
    expect(normalizeKoreanPhoneNumber("010-1234-5678")).toBe("01012345678");
    expect(normalizeKoreanPhoneNumber("02 1234 5678")).toBe("0212345678");
  });

  it("rejects non-Korean and malformed numbers", () => {
    expect(() => normalizeKoreanPhoneNumber("+1 415 555 0100")).toThrow();
    expect(() => normalizeKoreanPhoneNumber("010123")).toThrow();
  });
});
```

- [ ] **Step 4: Run the tests and verify the missing-module failure**

Run: `npm test -- src/features/reservations/schema.test.ts`

Expected: FAIL because `./schema` does not exist.

- [ ] **Step 5: Implement the reservation types and validation**

Create `src/features/reservations/types.ts`:

```ts
export const reservationStatuses = [
  "queued",
  "dialing",
  "connected",
  "retry_scheduled",
  "confirmed",
  "unavailable",
  "needs_human",
  "failed",
  "canceled",
] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

export type ReservationOutcome =
  | { result: "confirmed"; confirmedAt: string; confirmationName?: string; notes?: string }
  | { result: "unavailable"; alternatives: string[]; notes?: string }
  | { result: "needs_human"; reason: string };

export type CreateReservationInput = {
  idempotencyKey: string;
  destinationPhone: string;
  placeName: string;
  customerName: string;
  partySize: number;
  requestedAt: string;
  requestNotes?: string;
};

export type ReservationJob = CreateReservationInput & {
  id: string;
  tenantId: string;
  status: ReservationStatus;
  attemptCount: number;
  nextAttemptAt: string;
  outcome: ReservationOutcome | null;
  lastFailureReason: string | null;
  transcript: Array<{ role: "assistant" | "user"; text: string; at: string }>;
  createdAt: string;
  updatedAt: string;
};
```

Create `src/features/reservations/schema.ts`:

```ts
import { z } from "zod";

const timezoneIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function normalizeKoreanPhoneNumber(value: string): string {
  const normalized = value.replace(/[\s()-]/g, "");
  if (!/^0\d{8,10}$/.test(normalized)) {
    throw new Error("한국 국내 전화번호 형식이 아닙니다.");
  }
  return normalized;
}

export const createReservationInputSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  destinationPhone: z.string().transform(normalizeKoreanPhoneNumber),
  placeName: z.string().trim().min(1).max(100),
  customerName: z.string().trim().min(1).max(50),
  partySize: z.number().int().min(1).max(20),
  requestedAt: z.string().regex(timezoneIso, "timezone을 포함한 ISO 8601 형식이어야 합니다."),
  requestNotes: z.string().trim().max(500).optional(),
});

export const reservationIdSchema = z.object({ reservationId: z.string().uuid() });
export const listReservationsSchema = z.object({ limit: z.number().int().min(1).max(50).default(20) });
```

- [ ] **Step 6: Run the focused and full tests**

Run: `npm test -- src/features/reservations/schema.test.ts`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit the test foundation and contracts**

```bash
git add package.json package-lock.json vitest.config.mts src/features/reservations
git commit -m "test: add reservation domain contracts"
```

---

### Task 2: Supabase Durable Queue and Repository Contract

**Files:**
- Create: `supabase/migrations/202608160001_reservation_jobs.sql`
- Create: `src/lib/supabase-admin.ts`
- Create: `src/features/reservations/repository.ts`
- Create: `src/features/reservations/supabase-repository.ts`
- Test: `src/features/reservations/repository.test.ts`

**Interfaces:**
- Consumes: `CreateReservationInput`, `ReservationJob`, `ReservationOutcome`
- Produces: `ReservationRepository`, `SupabaseReservationRepository`, `ClaimedReservation`, `CallAttemptUpdate`

- [ ] **Step 1: Write the repository contract test against an in-memory test double**

Create `src/features/reservations/repository.test.ts` with a local `MemoryRepository` implementing the planned interface and these assertions:

```ts
it("returns the original row for the same tenant and idempotency key", async () => {
  const repo = new MemoryRepository();
  const first = await repo.createOrGet("tenant-a", validInput);
  const second = await repo.createOrGet("tenant-a", validInput);
  expect(second.id).toBe(first.id);
  expect(await repo.list("tenant-a", 20)).toHaveLength(1);
});

it("isolates identical idempotency keys between tenants", async () => {
  const repo = new MemoryRepository();
  const a = await repo.createOrGet("tenant-a", validInput);
  const b = await repo.createOrGet("tenant-b", validInput);
  expect(b.id).not.toBe(a.id);
  expect(await repo.get("tenant-a", b.id)).toBeNull();
});

it("only cancels queued or retry_scheduled jobs", async () => {
  const repo = new MemoryRepository();
  const queued = await repo.createOrGet("tenant-a", validInput);
  expect(await repo.cancel("tenant-a", queued.id)).toBe(true);
  expect(await repo.cancel("tenant-a", queued.id)).toBe(false);
});
```

The test double must implement the exact `ReservationRepository` interface from Step 3 so TypeScript checks the contract.

- [ ] **Step 2: Run the test and verify it fails because the repository contract is absent**

Run: `npm test -- src/features/reservations/repository.test.ts`

Expected: FAIL resolving `./repository`.

- [ ] **Step 3: Define the repository interface used by both deployment units**

Create `src/features/reservations/repository.ts`:

```ts
import type { CreateReservationInput, ReservationJob, ReservationOutcome } from "./types";

export type ClaimedReservation = ReservationJob & {
  lockedBy: string;
  lockedAt: string;
};

export type CallAttemptUpdate = {
  providerCallId?: string;
  status: string;
  answeredBy?: string;
  hangupCause?: string;
  durationSeconds?: number;
};

export interface ReservationRepository {
  createOrGet(tenantId: string, input: CreateReservationInput): Promise<ReservationJob>;
  get(tenantId: string, reservationId: string): Promise<ReservationJob | null>;
  list(tenantId: string, limit: number): Promise<ReservationJob[]>;
  cancel(tenantId: string, reservationId: string): Promise<boolean>;
  claimNext(workerId: string): Promise<ClaimedReservation | null>;
  heartbeat(reservationId: string, workerId: string): Promise<void>;
  markConnected(reservationId: string): Promise<void>;
  startAttempt(reservationId: string, attemptNumber: number, providerCallId: string): Promise<void>;
  appendTranscript(
    reservationId: string,
    segment: { role: "assistant" | "user"; text: string; at: string },
  ): Promise<void>;
  saveOutcome(reservationId: string, outcome: ReservationOutcome): Promise<void>;
  finish(reservationId: string, status: "confirmed" | "unavailable" | "needs_human"): Promise<void>;
  failOrRetry(reservationId: string, reason: string, retryAt: string | null): Promise<void>;
  completeAttempt(reservationId: string, attemptNumber: number, update: CallAttemptUpdate): Promise<void>;
  recoverStale(staleBefore: string): Promise<number>;
}
```

- [ ] **Step 4: Add the Postgres schema and atomic claim RPC**

Create `supabase/migrations/202608160001_reservation_jobs.sql`. It must create `tenants`, `api_keys`, `reservation_jobs`, and `call_attempts`; add the status and uniqueness checks from the spec; enable RLS; and revoke table access from `anon` and `authenticated`.

The claim function must use this exact locking pattern:

```sql
create or replace function public.claim_next_reservation(p_worker_id text)
returns setof public.reservation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id
    from public.reservation_jobs
    where status in ('queued', 'retry_scheduled')
      and next_attempt_at <= now()
    order by next_attempt_at, created_at
    for update skip locked
    limit 1
  )
  update public.reservation_jobs r
  set status = 'dialing',
      attempt_count = r.attempt_count + 1,
      locked_by = p_worker_id,
      locked_at = now(),
      heartbeat_at = now(),
      updated_at = now()
  from candidate
  where r.id = candidate.id
  returning r.*;
end;
$$;
```

Add `recover_stale_reservations(p_stale_before timestamptz)` that changes stale `dialing` or `connected` rows back to `queued`, clears lock fields, and returns the affected count.

- [ ] **Step 5: Create a server-only Supabase client and production repository**

Create `src/lib/supabase-admin.ts`:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase admin 환경변수가 필요합니다.");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

Create `SupabaseReservationRepository` with the exact interface from Step 3. Use snake-case rows only inside this adapter and map them to `ReservationJob` before returning. `createOrGet` must first insert, catch PostgreSQL unique violation `23505`, then query by `(tenant_id, idempotency_key)`. `cancel` must update only rows whose status is in `queued,retry_scheduled` and return whether a row was changed.

- [ ] **Step 6: Run contract tests and TypeScript/build validation**

Run: `npm test -- src/features/reservations/repository.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit the durable queue**

```bash
git add supabase/migrations src/lib/supabase-admin.ts src/features/reservations
git commit -m "feat: add durable reservation queue"
```

---

### Task 3: Tenant API-Key Authentication and Reservation Service

**Files:**
- Create: `src/features/auth/api-key-auth.ts`
- Create: `src/features/reservations/service.ts`
- Test: `src/features/auth/api-key-auth.test.ts`
- Test: `src/features/reservations/service.test.ts`

**Interfaces:**
- Consumes: `ReservationRepository`, Zod request schemas
- Produces: `authenticateApiKey(request): Promise<{ tenantId: string } | null>`, `ReservationService`

- [ ] **Step 1: Write failing API-key authentication tests**

Use a fake lookup function so no Supabase network call is made:

```ts
it("hashes the bearer token and returns its tenant", async () => {
  const lookup = vi.fn().mockResolvedValue("tenant-a");
  const rawKey = "call_abcdefghijklmnopqrstuvwxyz123456";
  const request = new Request("https://example.test/mcp", {
    headers: { Authorization: `Bearer ${rawKey}` },
  });
  await expect(authenticateApiKey(request, lookup)).resolves.toEqual({ tenantId: "tenant-a" });
  expect(lookup).toHaveBeenCalledWith(
    createHash("sha256").update(rawKey).digest("hex"),
  );
});

it("rejects missing, malformed, and revoked keys", async () => {
  const lookup = vi.fn().mockResolvedValue(null);
  await expect(authenticateApiKey(new Request("https://example.test/mcp"), lookup)).resolves.toBeNull();
});
```

- [ ] **Step 2: Write failing service tests for idempotency, tenant isolation, and cancellation**

Test that `create` validates and normalizes before calling `repository.createOrGet`, `get` returns `null` for another tenant, `list` caps at 50, and `cancel` does not cancel a `dialing` job.

- [ ] **Step 3: Run both test files and verify missing implementations**

Run: `npm test -- src/features/auth/api-key-auth.test.ts src/features/reservations/service.test.ts`

Expected: FAIL resolving the new modules.

- [ ] **Step 4: Implement API-key authentication**

Create `src/features/auth/api-key-auth.ts` with:

```ts
import { createHash } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type ApiKeyLookup = (hash: string) => Promise<string | null>;

export async function defaultApiKeyLookup(hash: string): Promise<string | null> {
  const { data, error } = await createSupabaseAdmin()
    .from("api_keys")
    .select("tenant_id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data?.tenant_id ?? null;
}

export async function authenticateApiKey(
  request: Request,
  lookup: ApiKeyLookup = defaultApiKeyLookup,
): Promise<{ tenantId: string } | null> {
  const match = request.headers.get("authorization")?.match(/^Bearer (call_[A-Za-z0-9_-]{24,})$/);
  if (!match) return null;
  const hash = createHash("sha256").update(match[1]).digest("hex");
  const tenantId = await lookup(hash);
  return tenantId ? { tenantId } : null;
}
```

- [ ] **Step 5: Implement the reservation service**

Create `ReservationService` with constructor `constructor(private readonly repository: ReservationRepository)`. Implement:

```ts
create(tenantId: string, unknownInput: unknown): Promise<ReservationJob>
get(tenantId: string, reservationId: string): Promise<ReservationJob | null>
list(tenantId: string, limit: number): Promise<ReservationJob[]>
cancel(tenantId: string, reservationId: string): Promise<{
  canceled: boolean;
  cancelable: boolean;
  job: ReservationJob | null;
}>
```

`create` must call `createReservationInputSchema.parse(unknownInput)`. `cancel` must fetch after the conditional repository update so callers receive the authoritative state. Set `cancelable` to `true` only when that final state is `queued` or `retry_scheduled`; after a successful cancellation return `{ canceled: true, cancelable: false, job }`.

- [ ] **Step 6: Run the focused tests**

Run: `npm test -- src/features/auth/api-key-auth.test.ts src/features/reservations/service.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit authentication and service behavior**

```bash
git add src/features/auth src/features/reservations
git commit -m "feat: add tenant reservation service"
```

---

### Task 4: Stateless Streamable HTTP MCP Endpoint

**Files:**
- Create: `src/features/mcp/reservation-server.ts`
- Create: `src/app/mcp/route.ts`
- Test: `src/features/mcp/reservation-server.test.ts`

**Interfaces:**
- Consumes: `ReservationService`, `authenticateApiKey`, `createMcpHandler`, reservation schemas
- Produces: `buildReservationMcpServer`, `createReservationMcpHandler`, Next.js `/mcp` GET/POST/DELETE handlers

- [ ] **Step 1: Write an in-process MCP integration test**

Create a real `Client` and `StreamableHTTPClientTransport`, but route its fetch directly to `createReservationMcpHandler`:

```ts
const handler = createReservationMcpHandler({ tenantId: "tenant-a", service });
const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
  fetch: (url, init) => handler.fetch(new Request(url, init)),
});
const client = new Client({ name: "test-client", version: "1.0.0" }, {
  versionNegotiation: { mode: "auto" },
});
await client.connect(transport);

const result = await client.callTool({
  name: "create_reservation_call",
  arguments: validInput,
});
expect(result.isError).not.toBe(true);
expect(result.structuredContent).toMatchObject({ status: "queued" });
```

In the same file, call `get_reservation_status`, `list_reservations`, and `cancel_reservation_call`; assert a tenant-scoped service is called and `create` returns immediately.

- [ ] **Step 2: Run the integration test and verify the missing-server failure**

Run: `npm test -- src/features/mcp/reservation-server.test.ts`

Expected: FAIL resolving `./reservation-server`.

- [ ] **Step 3: Register the four MCP tools with structured outputs**

Create `src/features/mcp/reservation-server.ts`. `buildReservationMcpServer` must construct:

```ts
new McpServer(
  { name: "reservation-caller", version: "0.1.0" },
  {
    capabilities: { tools: {} },
    instructions:
      "create_reservation_call은 비동기입니다. reservationId를 보관하고 get_reservation_status로 결과를 확인하세요.",
  },
);
```

Register exactly these names:

```text
create_reservation_call
get_reservation_status
list_reservations
cancel_reservation_call
```

Each successful handler must return both human-readable `content` and machine-readable `structuredContent`. Return `isError: true` for validation or not-found conditions without exposing stack traces or database error details.

Create the handler with:

```ts
export function createReservationMcpHandler(deps: McpDependencies) {
  return createMcpHandler(() => buildReservationMcpServer(deps));
}
```

- [ ] **Step 4: Add the authenticated Next.js Route Handler**

Create `src/app/mcp/route.ts`:

```ts
import { authenticateApiKey } from "@/features/auth/api-key-auth";
import { createReservationMcpHandler } from "@/features/mcp/reservation-server";
import { ReservationService } from "@/features/reservations/service";
import { SupabaseReservationRepository } from "@/features/reservations/supabase-repository";

export const runtime = "nodejs";

async function dispatch(request: Request): Promise<Response> {
  const principal = await authenticateApiKey(request);
  if (!principal) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const service = new ReservationService(new SupabaseReservationRepository());
  return createReservationMcpHandler({ tenantId: principal.tenantId, service }).fetch(request);
}

export { dispatch as GET, dispatch as POST, dispatch as DELETE };
```

- [ ] **Step 5: Run the integration test, lint, and typecheck**

Run: `npm test -- src/features/mcp/reservation-server.test.ts`

Expected: PASS.

Run: `npm run lint && npx tsc --noEmit`

Expected: both exit 0.

- [ ] **Step 6: Commit the MCP endpoint**

```bash
git add src/features/mcp src/app/mcp
git commit -m "feat: expose reservation MCP tools"
```

---

### Task 5: Tenant Provisioning, Environment Documentation, and Final Verification

**Files:**
- Create: `scripts/create-tenant.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `scripts/create-tenant.test.ts`

**Interfaces:**
- Consumes: `createSupabaseAdmin`
- Produces: `generateApiKey(): { rawKey: string; prefix: string; hash: string }`, `npm run tenant:create`

- [ ] **Step 1: Write a failing API-key generation test**

```ts
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { generateApiKey } from "./create-tenant";

it("creates a call_ key and a matching SHA-256 hash", () => {
  const key = generateApiKey();
  expect(key.rawKey).toMatch(/^call_[A-Za-z0-9_-]{24,}$/);
  expect(key.hash).toBe(createHash("sha256").update(key.rawKey).digest("hex"));
  expect(key.prefix).toBe(key.rawKey.slice(0, 12));
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- scripts/create-tenant.test.ts`

Expected: FAIL resolving `./create-tenant`.

- [ ] **Step 3: Implement one-time tenant and API-key provisioning**

`generateApiKey` must use `randomBytes(32).toString("base64url")`. The executable path must require `--name`, insert a tenant, insert `key_prefix` and `key_hash`, and print the raw key exactly once after both inserts succeed. It must never print `SUPABASE_SERVICE_ROLE_KEY` or the full inserted database row.

Add this script:

```json
{
  "scripts": {
    "tenant:create": "tsx scripts/create-tenant.ts"
  }
}
```

Install `tsx` as a development dependency in this plan:

```bash
npm install --save-dev tsx
```

- [ ] **Step 4: Document required server-only environment variables**

Append to `.env.example`:

```dotenv
# Supabase privileged server access — never expose to browser code
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Update `README.md` with these exact setup stages: apply `supabase/migrations/202608160001_reservation_jobs.sql`, run `npm run tenant:create -- --name "Demo Tenant"`, configure the returned bearer key in an MCP client pointing to `http://localhost:3000/mcp`, and use `get_reservation_status` after creation.

- [ ] **Step 5: Run all automated verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0. The build must show `/mcp` as a dynamic Route Handler and must not attempt a Supabase network request during build.

- [ ] **Step 6: Inspect the diff for secret leakage**

Run:

```bash
git diff --check
git diff -- . ':!package-lock.json'
```

Expected: no raw token beginning with `call_`, `sk_`, or a real Supabase service-role token appears.

- [ ] **Step 7: Commit the operable MCP milestone**

```bash
git add scripts package.json package-lock.json .env.example README.md
git commit -m "docs: add MCP tenant setup"
```

## Plan 1 Completion Gate

Before starting the voice-worker plan, verify all of the following:

- An authenticated MCP client can list and call all four tools in process.
- Creating the same idempotency key twice produces one DB job.
- A tenant cannot read or cancel another tenant's job.
- `create_reservation_call` returns while the job is still `queued`.
- The Supabase migration includes atomic `SKIP LOCKED` claim and stale-lock recovery.
- `npm test`, `npm run lint`, and `npm run build` pass.
