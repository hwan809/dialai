# Hosted MCP Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated DialAI user copy one command from the main page and use the hosted MCP without running a local web server or worker.

**Architecture:** The public Next.js service authenticates a Supabase access token and rotates a tenant-scoped MCP API key, returning the raw key exactly once with a copyable Codex command. Supabase stores only the SHA-256 hash. A separately deployed, always-on Node worker consumes the shared durable queue, so client machines run only Codex.

**Tech Stack:** Next.js 16 Route Handlers, Supabase Auth/Postgres, TypeScript, Zod, Vitest, Docker.

**Spec:** `docs/superpowers/specs/2026-08-16-generic-phone-calling-design.md`

## Global Constraints

- Do not modify frontend components; expose a stable JSON contract for the frontend owner.
- Never return an MCP key more than once or store its raw value in Postgres or logs.
- Require a valid Supabase user access token before issuing a calling credential.
- Keep `/mcp` stateless and keep telephone work outside the request lifecycle.
- Automated tests must not make network requests or phone calls.

---

### Task 1: Authenticated MCP Key Issuer

**Files:**
- Create: `src/features/onboarding/mcp-key-issuer.ts`
- Create: `src/features/onboarding/mcp-key-issuer.test.ts`
- Create: `src/features/onboarding/supabase-mcp-key-store.ts`
- Create: `supabase/migrations/202608160002_hosted_mcp_onboarding.sql`

**Interfaces:**
- Consumes: Supabase user ID, optional tenant name, public MCP URL.
- Produces: `McpKeyIssuer.issue({ userId, tenantName, mcpUrl }): Promise<{ apiKey: string; mcpUrl: string; installCommand: string }>` and `McpKeyStore.rotateForUser(...)`.

- [ ] **Step 1: Write a failing issuer test**

```ts
it("stores only a SHA-256 hash and returns a one-line Codex install command", async () => {
  const result = await issuer.issue({ userId: "user-1", tenantName: "Demo", mcpUrl: "https://dialai.app/mcp" });
  expect(store.rotateForUser).toHaveBeenCalledWith(expect.objectContaining({ keyHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  expect(result.installCommand).toContain("codex mcp add dialai");
});
```

- [ ] **Step 2: Run `npm test -- src/features/onboarding/mcp-key-issuer.test.ts` and verify missing-module RED**
- [ ] **Step 3: Implement the issuer, store contract, and Supabase RPC adapter**
- [ ] **Step 4: Add an idempotent SQL migration section that links tenants to `auth.users`, revokes prior active keys, and inserts only the new hash in one transaction**
- [ ] **Step 5: Run the focused test and `npx tsc --noEmit` for GREEN**

### Task 2: Main-Page Installation API

**Files:**
- Create: `src/features/auth/supabase-user-auth.ts`
- Create: `src/app/api/mcp/install/route.ts`
- Create: `src/app/api/mcp/install/route.test.ts`

**Interfaces:**
- Consumes: `Authorization: Bearer <Supabase access token>` and optional `{ tenantName }` JSON.
- Produces: HTTP 201 `{ apiKey, mcpUrl, installCommand }`, HTTP 401 for invalid auth, and `Cache-Control: no-store`.

- [ ] **Step 1: Write route tests for successful issuance, missing auth, invalid body, and no-store headers**
- [ ] **Step 2: Run `npm test -- src/app/api/mcp/install/route.test.ts` and verify missing-module RED**
- [ ] **Step 3: Implement a dependency-injected route handler plus the production Supabase wiring**
- [ ] **Step 4: Run the focused route tests for GREEN**

### Task 3: Hosted Worker Operations and Handoff

**Files:**
- Create: `Dockerfile.worker`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: hosted Supabase, ClawOps, and OpenAI environment variables.
- Produces: an always-on `npm run worker` container and frontend integration instructions using `installCommand`.

- [ ] **Step 1: Add the worker container definition with Node 22, `npm ci`, project copy, and `CMD ["npm", "run", "worker"]`**
- [ ] **Step 2: Document public web and worker process separation, required environment, and the frontend fetch contract**
- [ ] **Step 3: Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx next build --webpack`, and `git diff --check`**
- [ ] **Step 4: Review the final diff for secrets, raw phone numbers, and accidental frontend changes, then commit the hosted onboarding slice**

### Task 4: Runtime Fail-Closed and Voice Reliability

**Files:**
- Modify: `AGENTS.md`
- Modify: `src/features/mcp/phone-call-server.ts`
- Modify: `src/features/mcp/phone-call-server.test.ts`
- Modify: `src/features/voice/clawops-gateway.ts`
- Modify: `src/features/voice/clawops-gateway.test.ts`
- Modify: `src/features/voice/prompt.ts`
- Modify: `src/features/voice/prompt.test.ts`
- Create: `scripts/mcp-health.ts`
- Create: `scripts/mcp-health.test.ts`

**Interfaces:**
- Consumes: a configured remote MCP URL/token and an answered telephone call.
- Produces: `npm run mcp:check`, fail-closed Codex guidance, no pre-answer Realtime tool calls, and explicit ARS/DTMF behavior.

- [ ] **Step 1: Write failing tests for the complete MCP tool set, web-search tool description, disabled voice prewarm, and ARS prompt policy**
- [ ] **Step 2: Run focused tests and verify each expected RED**
- [ ] **Step 3: Implement the minimal fail-closed descriptions, readiness checker, prewarm change, and prompt policy**
- [ ] **Step 4: Run focused tests and verify GREEN without making a real phone call**
