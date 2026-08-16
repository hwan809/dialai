/* eslint-disable @typescript-eslint/no-unused-vars */

import { randomUUID } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/mcp/route";
import type { CallAttemptUpdate, ClaimedPhoneCall, PhoneCallRepository, TranscriptSegment } from "@/features/phone-calls/repository";
import { PhoneCallService } from "@/features/phone-calls/service";
import type { CreatePhoneCallInput, PhoneCallJob, PhoneCallOutcome } from "@/features/phone-calls/types";
import { createPhoneCallMcpHandler } from "./phone-call-server";

class MemoryRepository implements PhoneCallRepository {
  private readonly calls = new Map<string, PhoneCallJob>();
  async createOrGet(tenantId: string, input: CreatePhoneCallInput): Promise<PhoneCallJob> { const found = [...this.calls.values()].find((call) => call.tenantId === tenantId && call.idempotencyKey === input.idempotencyKey); if (found) return found; const now = new Date().toISOString(); const call: PhoneCallJob = { ...input, id: randomUUID(), tenantId, status: "queued", attemptCount: 0, nextAttemptAt: now, outcome: null, lastFailureReason: null, transcript: [], createdAt: now, updatedAt: now }; this.calls.set(call.id, call); return call; }
  async get(tenantId: string, callId: string) { const call = this.calls.get(callId); return call?.tenantId === tenantId ? call : null; }
  async list(tenantId: string, limit: number) { return [...this.calls.values()].filter((call) => call.tenantId === tenantId).slice(0, limit); }
  async cancel(tenantId: string, callId: string) { const call = await this.get(tenantId, callId); if (!call || call.status !== "queued") return false; this.calls.set(callId, { ...call, status: "canceled" }); return true; }
  async claimNext(_workerId: string): Promise<ClaimedPhoneCall | null> { return null; }
  async heartbeat(_callId: string, _workerId: string): Promise<void> {}
  async markConnected(_callId: string): Promise<void> {}
  async startAttempt(_callId: string, _attempt: number, _providerCallId: string): Promise<void> {}
  async appendTranscript(_callId: string, _segment: TranscriptSegment): Promise<void> {}
  async saveOutcome(_callId: string, _outcome: PhoneCallOutcome): Promise<void> {}
  async finish(_callId: string, _status: "completed" | "needs_human"): Promise<void> {}
  async failOrRetry(_callId: string, _reason: string, _retryAt: string | null): Promise<void> {}
  async completeAttempt(_callId: string, _attempt: number, _update: CallAttemptUpdate): Promise<void> {}
  async recoverStale(_staleBefore: string): Promise<number> { return 0; }
}

describe("phone-call MCP server", () => {
  it("serves all four tools through a real Streamable HTTP client", async () => {
    const handler = createPhoneCallMcpHandler({ tenantId: "tenant-a", service: new PhoneCallService(new MemoryRepository()) });
    const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), { fetch: (url, init) => handler.fetch(new Request(url, init)) });
    const client = new Client({ name: "test-client", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } });
    await client.connect(transport);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["create_phone_call", "get_phone_call", "list_phone_calls", "cancel_phone_call"]);
    const created = await client.callTool({ name: "create_phone_call", arguments: { idempotencyKey: "mcp-phone-call-001", destinationPhone: "02-1234-5678", objective: "오늘 영업시간을 확인해 주세요." } });
    expect(created.isError).not.toBe(true);
    expect(created.structuredContent).toMatchObject({ status: "queued" });
    const callId = (created.structuredContent as { callId: string }).callId;
    await expect(client.callTool({ name: "get_phone_call", arguments: { callId } })).resolves.toMatchObject({ structuredContent: { id: callId } });
    await expect(client.callTool({ name: "list_phone_calls", arguments: { limit: 50 } })).resolves.toMatchObject({ structuredContent: { calls: [{ id: callId }] } });
    await expect(client.callTool({ name: "cancel_phone_call", arguments: { callId } })).resolves.toMatchObject({ structuredContent: { canceled: true, job: { status: "canceled" } } });
    await expect(client.callTool({ name: "create_phone_call", arguments: { objective: "missing required fields" } })).resolves.toMatchObject({ isError: true });
    await client.close();
  });
  it("rejects unauthenticated route requests before MCP dispatch", async () => { const response = await POST(new Request("http://test.local/mcp", { method: "POST" })); expect(response.status).toBe(401); await expect(response.json()).resolves.toEqual({ error: "unauthorized" }); });
});
