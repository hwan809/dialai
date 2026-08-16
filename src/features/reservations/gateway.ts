import ky from "ky";
import { getDemoReservationSnapshot } from "./demo-timeline";
import { reservationJobSchema } from "./schema";
import type { CreateReservationInput, ReservationJob, UserCallResponse } from "./types";

export interface ReservationGateway {
  cancel(id: string): Promise<ReservationJob>;
  create(input: CreateReservationInput): Promise<ReservationJob>;
  get(id: string): Promise<ReservationJob>;
  respond(id: string, response: UserCallResponse): Promise<ReservationJob>;
}

class DemoReservationGateway implements ReservationGateway {
  readonly #jobs = new Map<string, ReservationJob>();
  readonly #responses = new Map<string, UserCallResponse & { readonly answeredAt: string }>();

  async create(input: CreateReservationInput): Promise<ReservationJob> {
    const now = new Date().toISOString();
    const job: ReservationJob = {
      ...input,
      attemptCount: 0,
      createdAt: now,
      id: crypto.randomUUID(),
      lastFailureReason: null,
      outcome: null,
      status: "queued",
      transcript: [],
      updatedAt: now,
    };
    this.#jobs.set(job.id, job);
    return job;
  }

  async get(id: string): Promise<ReservationJob> {
    const job = this.#jobs.get(id);
    if (job === undefined) {
      throw new ReservationGatewayError("예약 작업을 찾을 수 없습니다.");
    }
    const snapshot = getDemoReservationSnapshot(
      job.createdAt,
      new Date(),
      job.requestedAt,
      this.#responses.get(id),
    );
    const updated = { ...job, ...snapshot, updatedAt: new Date().toISOString() };
    this.#jobs.set(id, updated);
    return updated;
  }

  async cancel(id: string): Promise<ReservationJob> {
    const job = await this.get(id);
    const canceled = { ...job, status: "canceled" as const, updatedAt: new Date().toISOString() };
    this.#jobs.set(id, canceled);
    return canceled;
  }

  async respond(id: string, response: UserCallResponse): Promise<ReservationJob> {
    const job = await this.get(id);
    if (job.status !== "needs_user_input") {
      throw new ReservationGatewayError("현재 사용자 확인이 필요한 상태가 아닙니다.");
    }
    this.#responses.set(id, { ...response, answeredAt: new Date().toISOString() });
    return this.get(id);
  }
}

class HttpReservationGateway implements ReservationGateway {
  async create(input: CreateReservationInput): Promise<ReservationJob> {
    const response = await ky.post("/api/reservations", { json: input }).json();
    return reservationJobSchema.parse(response);
  }

  async get(id: string): Promise<ReservationJob> {
    const response = await ky.get(`/api/reservations/${id}`).json();
    return reservationJobSchema.parse(response);
  }

  async cancel(id: string): Promise<ReservationJob> {
    const response = await ky.post(`/api/reservations/${id}/cancel`).json();
    return reservationJobSchema.parse(response);
  }

  async respond(id: string, response: UserCallResponse): Promise<ReservationJob> {
    const result = await ky.post(`/api/reservations/${id}/respond`, { json: response }).json();
    return reservationJobSchema.parse(result);
  }
}

export class ReservationGatewayError extends Error {
  readonly name = "ReservationGatewayError";
}

export function createReservationGateway(): ReservationGateway {
  return process.env.NEXT_PUBLIC_RESERVATION_DEMO_MODE === "false"
    ? new HttpReservationGateway()
    : new DemoReservationGateway();
}
