import type { ReservationJob } from "./types";

export type ResultContent = {
  readonly badge: string;
  readonly summary: string;
  readonly surfaceTone: "error" | "success" | "warning";
  readonly title: string;
  readonly tone: "error" | "success" | "warning";
};

export function getResultContent(job: ReservationJob): ResultContent {
  switch (job.status) {
    case "completed": {
      const outcome = job.outcome?.result === "completed" ? job.outcome : null;
      const needsFollowUp = outcome?.needsFollowUp ?? true;
      return needsFollowUp
        ? {
            badge: "후속 확인 필요",
            summary: outcome?.summary ?? "통화 결과를 직접 확인해주세요.",
            surfaceTone: "warning",
            title: "추가로 확인할 내용이 있습니다",
            tone: "warning",
          }
        : {
            badge: "통화 완료",
            summary: outcome?.summary ?? "통화가 완료되었습니다.",
            surfaceTone: "success",
            title: "전화 업무를 완료했습니다",
            tone: "success",
          };
    }
    case "confirmed":
      return { badge: "처리 완료", summary: "요청한 조건으로 예약이 확정됐어요.", surfaceTone: "success", title: "예약이 완료됐습니다", tone: "success" };
    case "unavailable":
      return { badge: "예약 불가", summary: "요청한 조건으로 가능한 예약을 찾지 못했어요.", surfaceTone: "warning", title: "요청한 예약이 어렵습니다", tone: "warning" };
    case "needs_human":
      return { badge: "확인 필요", summary: job.outcome?.result === "needs_human" ? (job.outcome.summary ?? job.outcome.reason) : "사용자가 직접 확인해야 하는 내용이 남아 있어요.", surfaceTone: "warning", title: "직접 확인이 필요합니다", tone: "warning" };
    case "canceled":
      return { badge: "요청 취소", summary: "전화가 연결되기 전에 요청을 취소했어요.", surfaceTone: "error", title: "전화 요청이 취소됐습니다", tone: "error" };
    case "failed":
    case "ars":
    case "connected":
    case "dialing":
    case "needs_user_input":
    case "queued":
    case "retry_scheduled":
    case "waiting":
      return { badge: "처리 실패", summary: job.lastFailureReason ?? "전화 연결을 완료하지 못했어요.", surfaceTone: "error", title: "전화 연결에 실패했습니다", tone: "error" };
  }
}
