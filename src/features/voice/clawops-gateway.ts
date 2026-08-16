import { ClawOps } from "@teamlearners/clawops";
import { BuiltinTool, ClawOpsAgent, OpenAIRealtime } from "@teamlearners/clawops/agent";
import { z } from "zod";

import type { PhoneCallJob, PhoneCallOutcome } from "@/features/phone-calls/types";

import type { VoiceCallResult, VoiceCallbacks, VoiceGateway, VoiceTerminalStatus } from "./gateway";
import { buildPhoneCallPrompt } from "./prompt";

const phoneCallOutcomeSchema = z.discriminatedUnion("result", [
  z.object({
    result: z.literal("completed"),
    summary: z.string().min(1),
    facts: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })),
    needsFollowUp: z.boolean(),
  }),
  z.object({
    result: z.literal("needs_human"),
    summary: z.string().min(1),
    reason: z.string().min(1),
  }),
]);

export type ClawOpsVoiceGatewayOptions = {
  fromNumber: string;
  apiKey?: string;
  accountId?: string;
  openAiApiKey?: string;
};

type CallDetailClient = {
  calls?: {
    get(callId: string): Promise<{ hangupCause?: string | null }>;
  };
};

const outcomeToolParameters = {
  result: { type: "string", enum: ["completed", "needs_human"] },
  summary: { type: "string" },
  facts: {
    type: "array",
    items: {
      type: "object",
      properties: {
        label: { type: "string" },
        value: { type: "string" },
      },
      required: ["label", "value"],
    },
  },
  needsFollowUp: { type: "boolean" },
  reason: { type: "string" },
} as const;

export class ClawOpsVoiceGateway implements VoiceGateway {
  private readonly detailClient: CallDetailClient | undefined;

  constructor(
    private readonly options: ClawOpsVoiceGatewayOptions,
    detailClient?: CallDetailClient,
  ) {
    this.detailClient = detailClient ?? (options.apiKey ? new ClawOps({
      apiKey: options.apiKey,
      accountId: options.accountId,
    }) : undefined);
  }

  async call(job: PhoneCallJob, callbacks: VoiceCallbacks): Promise<VoiceCallResult> {
    let outcome: PhoneCallOutcome | null = null;
    const realtime = new OpenAIRealtime({
      apiKey: this.options.openAiApiKey,
      systemPrompt: buildPhoneCallPrompt(job),
      model: "gpt-realtime-2",
      voice: "marin",
      language: "ko",
      greeting: true,
    });
    const agent = new ClawOpsAgent({
      apiKey: this.options.apiKey,
      accountId: this.options.accountId,
      from: this.options.fromNumber,
      session: realtime,
      recording: false,
      prewarmEnabled: true,
      builtinTools: [BuiltinTool.HANG_UP, BuiltinTool.SEND_DTMF],
    });

    agent.tool({
      name: "record_call_outcome",
      description: "통화의 확인된 결과를 기록합니다.",
      parameters: outcomeToolParameters,
      required: ["result", "summary"],
      handler: async (args) => {
        const parsedOutcome = phoneCallOutcomeSchema.parse(args) as PhoneCallOutcome;
        outcome = parsedOutcome;
        await callbacks.onOutcome(parsedOutcome);
        return "결과가 기록되었습니다.";
      },
    });
    agent.on("call_start", () => void callbacks.onConnected());
    agent.on("transcript", (_call, role: string, text: string) => {
      if ((role === "assistant" || role === "user") && text.trim()) {
        void callbacks.onTranscript({ role, text: text.trim(), at: new Date().toISOString() });
      }
    });

    try {
      const call = await agent.call(job.destinationPhone, {
        timeout: 60,
        machineDetection: "Enable",
      });
      await callbacks.onInitiated(call.callId);
      await call.wait();

      const terminalStatus = toTerminalStatus(call.endedStatus);
      const detail = await this.getCallDetail(call.callId);

      return {
        providerCallId: call.callId,
        terminalStatus,
        durationSeconds: call.endedDuration,
        ...(detail?.hangupCause ? { hangupCause: detail.hangupCause } : {}),
        outcome,
      };
    } finally {
      await agent.disconnect();
    }
  }

  private async getCallDetail(callId: string): Promise<{ hangupCause?: string | null } | undefined> {
    if (!this.detailClient?.calls?.get) return undefined;

    try {
      return await this.detailClient.calls.get(callId);
    } catch {
      return undefined;
    }
  }
}

function toTerminalStatus(status: string | null): VoiceTerminalStatus {
  switch (status) {
    case "completed":
    case "no-answer":
    case "busy":
    case "rejected":
    case "canceled":
    case "failed":
      return status;
    default:
      return "failed";
  }
}
