import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

import type {
  CallAttemptUpdate,
  ClaimedPhoneCall,
  PhoneCallRepository,
  TranscriptSegment,
} from "./repository";
import type { CreatePhoneCallInput, PhoneCallJob, PhoneCallOutcome, PhoneCallStatus } from "./types";

type PhoneCallRow = {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  destination_phone: string;
  objective: string;
  context: string | null;
  success_criteria: string[] | null;
  status: PhoneCallStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  outcome: PhoneCallOutcome | null;
  transcript: TranscriptSegment[];
  last_failure_reason: string | null;
  created_at: string;
  updated_at: string;
  locked_by?: string | null;
  locked_at?: string | null;
};

type PostgrestError = { code?: string; message: string };

function throwIfError(error: PostgrestError | null): void {
  if (error) throw new Error(error.message);
}

export function mapPhoneCallJob(row: PhoneCallRow): PhoneCallJob {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    idempotencyKey: row.idempotency_key,
    destinationPhone: row.destination_phone,
    objective: row.objective,
    ...(row.context === null ? {} : { context: row.context }),
    ...(row.success_criteria === null ? {} : { successCriteria: row.success_criteria }),
    status: row.status,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    outcome: row.outcome,
    transcript: row.transcript,
    lastFailureReason: row.last_failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClaimedPhoneCall(row: PhoneCallRow): ClaimedPhoneCall {
  if (!row.locked_by || !row.locked_at) {
    throw new Error("Claimed phone call is missing its worker lock.");
  }
  return { ...mapPhoneCallJob(row), lockedBy: row.locked_by, lockedAt: row.locked_at };
}

export class SupabasePhoneCallRepository implements PhoneCallRepository {
  constructor(private readonly client: SupabaseClient = createSupabaseAdmin()) {}

  async createOrGet(tenantId: string, input: CreatePhoneCallInput): Promise<PhoneCallJob> {
    const { data, error } = await this.client
      .from("phone_call_jobs")
      .insert({
        tenant_id: tenantId,
        idempotency_key: input.idempotencyKey,
        destination_phone: input.destinationPhone,
        objective: input.objective,
        context: input.context ?? null,
        success_criteria: input.successCriteria ?? null,
      })
      .select()
      .single();

    if (!error && data) return mapPhoneCallJob(data as PhoneCallRow);
    if (error?.code !== "23505") throwIfError(error as PostgrestError | null);

    const existing = await this.client
      .from("phone_call_jobs")
      .select()
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    throwIfError(existing.error as PostgrestError | null);
    if (!existing.data) {
      throw new Error("Idempotent phone call could not be retrieved.");
    }
    return mapPhoneCallJob(existing.data as PhoneCallRow);
  }

  async get(tenantId: string, callId: string): Promise<PhoneCallJob | null> {
    const result = await this.client
      .from("phone_call_jobs")
      .select()
      .eq("tenant_id", tenantId)
      .eq("id", callId)
      .maybeSingle();
    throwIfError(result.error as PostgrestError | null);
    return result.data ? mapPhoneCallJob(result.data as PhoneCallRow) : null;
  }

  async list(tenantId: string, limit: number): Promise<PhoneCallJob[]> {
    const result = await this.client
      .from("phone_call_jobs")
      .select()
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    throwIfError(result.error as PostgrestError | null);
    return (result.data ?? []).map((row) => mapPhoneCallJob(row as PhoneCallRow));
  }

  async cancel(tenantId: string, callId: string): Promise<boolean> {
    const result = await this.client
      .from("phone_call_jobs")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", callId)
      .in("status", ["queued", "retry_scheduled"])
      .select("id");
    throwIfError(result.error as PostgrestError | null);
    return (result.data?.length ?? 0) === 1;
  }

  async claimNext(workerId: string): Promise<ClaimedPhoneCall | null> {
    const result = await this.client.rpc("claim_next_phone_call", { p_worker_id: workerId });
    throwIfError(result.error as PostgrestError | null);
    const row = Array.isArray(result.data) ? result.data[0] : null;
    return row ? mapClaimedPhoneCall(row as PhoneCallRow) : null;
  }

  async heartbeat(callId: string, workerId: string): Promise<void> {
    const result = await this.client
      .from("phone_call_jobs")
      .update({ heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", callId)
      .eq("locked_by", workerId)
      .in("status", ["dialing", "connected"]);
    throwIfError(result.error as PostgrestError | null);
  }

  async markConnected(callId: string): Promise<void> {
    const result = await this.client
      .from("phone_call_jobs")
      .update({ status: "connected", updated_at: new Date().toISOString() })
      .eq("id", callId)
      .eq("status", "dialing");
    throwIfError(result.error as PostgrestError | null);
  }

  async startAttempt(callId: string, attemptNumber: number, providerCallId: string): Promise<void> {
    const result = await this.client.from("phone_call_attempts").insert({
      phone_call_job_id: callId,
      attempt_number: attemptNumber,
      provider_call_id: providerCallId,
      status: "dialing",
      started_at: new Date().toISOString(),
    });
    throwIfError(result.error as PostgrestError | null);
  }

  async appendTranscript(callId: string, segment: TranscriptSegment): Promise<void> {
    const result = await this.client.rpc("append_phone_call_transcript", {
      p_job_id: callId,
      p_segment: segment,
    });
    throwIfError(result.error as PostgrestError | null);
  }

  async saveOutcome(callId: string, outcome: PhoneCallOutcome): Promise<void> {
    const result = await this.client
      .from("phone_call_jobs")
      .update({ outcome, updated_at: new Date().toISOString() })
      .eq("id", callId);
    throwIfError(result.error as PostgrestError | null);
  }

  async finish(callId: string, status: "completed" | "needs_human"): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.client
      .from("phone_call_jobs")
      .update({
        status,
        completed_at: now,
        locked_by: null,
        locked_at: null,
        heartbeat_at: null,
        next_attempt_at: null,
        updated_at: now,
      })
      .eq("id", callId);
    throwIfError(result.error as PostgrestError | null);
  }

  async failOrRetry(callId: string, reason: string, retryAt: string | null): Promise<void> {
    const result = await this.client.rpc("fail_or_retry_phone_call", {
      p_job_id: callId,
      p_reason: reason,
      p_retry_at: retryAt,
    });
    throwIfError(result.error as PostgrestError | null);
  }

  async completeAttempt(
    callId: string,
    attemptNumber: number,
    update: CallAttemptUpdate,
  ): Promise<void> {
    const result = await this.client
      .from("phone_call_attempts")
      .update({
        provider_call_id: update.providerCallId,
        status: update.status,
        answered_by: update.answeredBy,
        hangup_cause: update.hangupCause,
        duration_seconds: update.durationSeconds,
        ended_at: new Date().toISOString(),
      })
      .eq("phone_call_job_id", callId)
      .eq("attempt_number", attemptNumber);
    throwIfError(result.error as PostgrestError | null);
  }

  async recoverStale(staleBefore: string): Promise<number> {
    const result = await this.client.rpc("recover_stale_phone_calls", {
      p_stale_before: staleBefore,
    });
    throwIfError(result.error as PostgrestError | null);
    return Number(result.data ?? 0);
  }
}
