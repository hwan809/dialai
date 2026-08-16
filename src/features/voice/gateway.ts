import type { PhoneCallJob, PhoneCallOutcome } from "@/features/phone-calls/types";

export type VoiceCallbacks = {
  onInitiated(providerCallId: string): Promise<void>;
  onConnected(): Promise<void>;
  onTranscript(segment: {
    role: "assistant" | "user";
    text: string;
    at: string;
  }): Promise<void>;
  onOutcome(outcome: PhoneCallOutcome): Promise<void>;
};

export type VoiceTerminalStatus =
  | "completed"
  | "no-answer"
  | "busy"
  | "rejected"
  | "canceled"
  | "failed";

export type VoiceCallResult = {
  providerCallId: string;
  terminalStatus: VoiceTerminalStatus;
  durationSeconds: number | null;
  answeredBy?: string;
  hangupCause?: string;
  outcome: PhoneCallOutcome | null;
};

export interface VoiceGateway {
  call(job: PhoneCallJob, callbacks: VoiceCallbacks): Promise<VoiceCallResult>;
}
