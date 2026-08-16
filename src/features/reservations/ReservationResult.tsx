import { CheckCircle, PhoneCall, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Surface } from "@/components/ui/Surface";
import { Transcript } from "@/components/ui/Transcript";
import { formatKoreanDateTime } from "./schema";
import type { ReservationJob, ReservationOutcome } from "./types";

type ReservationResultProps = {
  readonly job: ReservationJob;
  readonly onReset: () => void;
};

export function ReservationResult({ job, onReset }: ReservationResultProps) {
  const result = getResultPresentation(job);
  return (
    <section aria-labelledby="result-heading" className="screen-stack">
      <header className="screen-header">
        <StatusBadge tone={result.tone}>{result.badge}</StatusBadge>
        <h1 id="result-heading" className="screen-title">{result.title}</h1>
        <p className="screen-description">처리 결과와 통화 내용을 확인해주세요.</p>
      </header>

      <Surface tone={result.surfaceTone}>
        <div className="result-heading">
          <span className="result-icon" aria-hidden>{result.icon}</span>
          <div>
            <h2>최종 처리 결과</h2>
            <p>{result.summary}</p>
          </div>
        </div>
        {job.outcome !== null && <OutcomeDetails outcome={job.outcome} />}
      </Surface>

      <Surface>
        <div className="section-heading">
          <h2>통화 요약</h2>
          <p>{getCallSummary(job)}</p>
        </div>
      </Surface>

      <details className="result-transcript">
        <summary>전체 통화 내용 보기</summary>
        <div className="result-transcript__body">
          <Transcript messages={job.transcript} emptyMessage="저장된 통화 내용이 없습니다." />
        </div>
      </details>

      <div className="action-row action-row--end">
        <Button leadingIcon={<PhoneCall size={18} />} onClick={onReset}>새 전화 요청</Button>
      </div>
    </section>
  );
}

function OutcomeDetails({ outcome }: { readonly outcome: ReservationOutcome }) {
  switch (outcome.result) {
    case "confirmed":
      return (
        <dl className="result-details">
          <div><dt>확정 시간</dt><dd>{formatKoreanDateTime(outcome.confirmedAt)}</dd></div>
          <div><dt>예약자명</dt><dd>{outcome.confirmationName ?? "확인되지 않음"}</dd></div>
          {outcome.notes !== undefined && <div><dt>안내</dt><dd>{outcome.notes}</dd></div>}
        </dl>
      );
    case "unavailable":
      return <p className="result-detail-copy">가능한 대안: {outcome.alternatives.join(", ") || "없음"}</p>;
    case "needs_human":
      return <p className="result-detail-copy">확인 필요: {outcome.reason}</p>;
  }
}

type ResultPresentation = {
  readonly badge: string;
  readonly icon: ReactNode;
  readonly summary: string;
  readonly surfaceTone: "error" | "success" | "warning";
  readonly title: string;
  readonly tone: "error" | "success" | "warning";
};

function getResultPresentation(job: ReservationJob): ResultPresentation {
  switch (job.status) {
    case "confirmed":
      return { badge: "처리 완료", icon: <CheckCircle size={28} weight="fill" />, summary: "요청한 조건으로 예약이 확정됐어요.", surfaceTone: "success", title: "예약이 완료됐습니다", tone: "success" };
    case "unavailable":
      return { badge: "예약 불가", icon: <WarningCircle size={28} weight="fill" />, summary: "요청한 조건으로 가능한 예약을 찾지 못했어요.", surfaceTone: "warning", title: "요청한 예약이 어렵습니다", tone: "warning" };
    case "needs_human":
      return { badge: "확인 필요", icon: <WarningCircle size={28} weight="fill" />, summary: "사용자가 직접 확인해야 하는 내용이 남아 있어요.", surfaceTone: "warning", title: "직접 확인이 필요합니다", tone: "warning" };
    case "canceled":
      return { badge: "요청 취소", icon: <XCircle size={28} weight="fill" />, summary: "전화가 연결되기 전에 요청을 취소했어요.", surfaceTone: "error", title: "전화 요청이 취소됐습니다", tone: "error" };
    case "failed":
    case "ars":
    case "connected":
    case "dialing":
    case "needs_user_input":
    case "queued":
    case "retry_scheduled":
    case "waiting":
      return { badge: "처리 실패", icon: <XCircle size={28} weight="fill" />, summary: job.lastFailureReason ?? "전화 연결을 완료하지 못했어요.", surfaceTone: "error", title: "전화 연결에 실패했습니다", tone: "error" };
  }
}

function getCallSummary(job: ReservationJob): string {
  if (job.status === "confirmed") {
    return `${job.placeName}에서 ${job.partySize}명 예약을 확정했습니다.`;
  }
  return `${job.placeName}에 전화를 시도했지만 업무를 완료하지 못했습니다. 최종 처리 결과를 확인해주세요.`;
}
