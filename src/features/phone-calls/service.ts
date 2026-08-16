import { createPhoneCallInputSchema } from "./schema";
import type { PhoneCallRepository } from "./repository";
import type { PhoneCallJob } from "./types";

export type CancelPhoneCallResult = { canceled: boolean; cancelable: boolean; job: PhoneCallJob | null };

export class PhoneCallService {
  constructor(private readonly repository: PhoneCallRepository) {}

  async create(tenantId: string, unknownInput: unknown): Promise<PhoneCallJob> {
    return this.repository.createOrGet(tenantId, createPhoneCallInputSchema.parse(unknownInput));
  }

  get(tenantId: string, callId: string): Promise<PhoneCallJob | null> { return this.repository.get(tenantId, callId); }

  list(tenantId: string, limit = 20): Promise<PhoneCallJob[]> {
    return this.repository.list(tenantId, Math.min(Math.max(Math.floor(limit), 1), 50));
  }

  async cancel(tenantId: string, callId: string): Promise<CancelPhoneCallResult> {
    const canceled = await this.repository.cancel(tenantId, callId);
    const job = await this.repository.get(tenantId, callId);
    return { canceled, cancelable: !canceled && Boolean(job && ["queued", "retry_scheduled"].includes(job.status)), job };
  }
}
