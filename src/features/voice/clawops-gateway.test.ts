import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PhoneCallJob } from "@/features/phone-calls/types";

const mocks = vi.hoisted(() => ({
  agentInstances: [] as unknown[],
  realtimeOptions: [] as Array<Record<string, unknown>>,
  callLifecycle: [] as string[],
}));

type FakeAgent = {
  options: Record<string, unknown>;
  handlers: Map<string, (...args: unknown[]) => unknown>;
  callSession: {
    callId: string;
    endedStatus: string | null;
    endedDuration: number | null;
    wait: ReturnType<typeof vi.fn>;
    finish(): void;
  };
  call: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  tool: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

vi.mock("@teamlearners/clawops/agent", () => ({
  BuiltinTool: { HANG_UP: "hang_up", SEND_DTMF: "send_dtmf" },
  ClawOpsAgent: class {
    readonly handlers = new Map<string, (...args: unknown[]) => unknown>();
    readonly callSession = {
      callId: "provider_call_123",
      endedStatus: "completed" as string | null,
      endedDuration: 42 as number | null,
      resolveWait: undefined as (() => void) | undefined,
      wait: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            mocks.callLifecycle.push("wait");
            this.callSession.resolveWait = resolve;
          }),
      ),
      finish: () => this.callSession.resolveWait?.(),
    };
    readonly call = vi.fn(async () => this.callSession);
    readonly disconnect = vi.fn(async () => undefined);
    readonly tool = vi.fn(() => this);
    readonly on = vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      this.handlers.set(event, handler);
      return this;
    });

    constructor(readonly options: Record<string, unknown>) {
      mocks.agentInstances.push(this);
    }
  },
  OpenAIRealtime: class {
    constructor(options: Record<string, unknown>) {
      mocks.realtimeOptions.push(options);
    }
  },
}));

vi.mock("@teamlearners/clawops", () => ({
  ClawOps: class {},
}));

import { ClawOpsVoiceGateway } from "./clawops-gateway";

const job: PhoneCallJob = {
  id: "call_123",
  idempotencyKey: "call-key-123",
  tenantId: "tenant_123",
  destinationPhone: "01012345678",
  objective: "내일 영업시간을 확인해 주세요.",
  context: undefined,
  successCriteria: ["영업시간"],
  status: "queued",
  attemptCount: 1,
  nextAttemptAt: null,
  outcome: null,
  lastFailureReason: null,
  transcript: [],
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
};

function callbacks() {
  return {
    onInitiated: vi.fn(async () => undefined),
    onConnected: vi.fn(async () => undefined),
    onTranscript: vi.fn(async () => undefined),
    onOutcome: vi.fn(async () => undefined),
  };
}

describe("ClawOpsVoiceGateway", () => {
  beforeEach(() => {
    mocks.agentInstances.length = 0;
    mocks.realtimeOptions.length = 0;
    mocks.callLifecycle.length = 0;
  });

  it("returns the provider result after forwarding call events and a validated outcome", async () => {
    const recorded = callbacks();
    recorded.onInitiated.mockImplementation(async () => {
      mocks.callLifecycle.push("initiated");
    });
    const detailClient = { calls: { get: vi.fn(async () => ({ hangupCause: "NORMAL_CLEARING" })) } };
    const gateway = new ClawOpsVoiceGateway(
      {
        fromNumber: "07012345678",
        apiKey: "clawops-key",
        accountId: "account_123",
        openAiApiKey: "openai-key",
      },
      detailClient,
    );

    const callPromise = gateway.call(job, recorded);
    await vi.waitFor(() => expect(mocks.agentInstances).toHaveLength(1));
    const agent = mocks.agentInstances[0] as FakeAgent;
    const outcomeTool = agent.tool.mock.calls[0]?.[0] as {
      name: string;
      handler: (args: unknown) => Promise<string>;
    };

    expect(agent.options).toMatchObject({
      from: "07012345678",
      recording: false,
      prewarmEnabled: true,
      builtinTools: ["hang_up", "send_dtmf"],
    });
    expect(mocks.realtimeOptions[0]).toMatchObject({
      model: "gpt-realtime-2",
      voice: "marin",
      language: "ko",
      greeting: true,
    });
    expect(outcomeTool.name).toBe("record_call_outcome");
    expect(agent.call).toHaveBeenCalledWith("01012345678", {
      timeout: 60,
      machineDetection: "Enable",
    });

    await agent.handlers.get("call_start")?.({});
    await agent.handlers.get("transcript")?.({}, "assistant", "안녕하세요");
    await agent.handlers.get("transcript")?.({}, "user", "오후 6시까지입니다");
    await outcomeTool.handler({
      result: "completed",
      summary: "내일 오후 6시까지 영업한다고 확인했습니다.",
      facts: [{ label: "영업시간", value: "오후 6시까지" }],
      needsFollowUp: false,
    });
    await vi.waitFor(() => expect(agent.callSession.wait).toHaveBeenCalledOnce());
    agent.callSession.finish();

    const result = await callPromise;

    expect(recorded.onInitiated).toHaveBeenCalledWith("provider_call_123");
    expect(mocks.callLifecycle).toEqual(["initiated", "wait"]);
    expect(recorded.onConnected).toHaveBeenCalledOnce();
    expect(recorded.onTranscript).toHaveBeenCalledTimes(2);
    expect(recorded.onOutcome).toHaveBeenCalledWith({
      result: "completed",
      summary: "내일 오후 6시까지 영업한다고 확인했습니다.",
      facts: [{ label: "영업시간", value: "오후 6시까지" }],
      needsFollowUp: false,
    });
    expect(detailClient.calls.get).toHaveBeenCalledWith("provider_call_123");
    expect(result).toEqual({
      providerCallId: "provider_call_123",
      terminalStatus: "completed",
      durationSeconds: 42,
      hangupCause: "NORMAL_CLEARING",
      outcome: {
        result: "completed",
        summary: "내일 오후 6시까지 영업한다고 확인했습니다.",
        facts: [{ label: "영업시간", value: "오후 6시까지" }],
        needsFollowUp: false,
      },
    });
    expect(agent.disconnect).toHaveBeenCalledOnce();
  });

  it("does not invent an outcome when an unanswered call has no detail record", async () => {
    const recorded = callbacks();
    const detailClient = { calls: { get: vi.fn(async () => { throw new Error("not ready"); }) } };
    const gateway = new ClawOpsVoiceGateway({ fromNumber: "07012345678" }, detailClient);

    const callPromise = gateway.call(job, recorded);
    await vi.waitFor(() => expect(mocks.agentInstances).toHaveLength(1));
    const agent = mocks.agentInstances[0] as FakeAgent;
    agent.callSession.endedStatus = "no-answer";
    agent.callSession.endedDuration = null;
    await vi.waitFor(() => expect(agent.callSession.wait).toHaveBeenCalledOnce());
    agent.callSession.finish();

    const result = await callPromise;

    expect(recorded.onOutcome).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      providerCallId: "provider_call_123",
      terminalStatus: "no-answer",
      durationSeconds: null,
      outcome: null,
    });
    expect(result.hangupCause).toBeUndefined();
    expect(agent.disconnect).toHaveBeenCalledOnce();
  });
});
