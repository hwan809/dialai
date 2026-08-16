import { CheckCircle, PhoneCall, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Surface } from "@/components/ui/Surface";
import { Transcript } from "@/components/ui/Transcript";
import { formatKoreanDateTime } from "./schema";
import { getResultContent } from "./result-content";
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
          <span className="result-icon" aria-hidden>{getResultIcon(result.tone)}</span>
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
    case "completed":
      return outcome.facts.length > 0 ? (
        <dl className="result-details">
          {outcome.facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
          ))}
        </dl>
      ) : <p className="result-detail-copy">추가로 확인된 사실이 없습니다.</p>;
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

function getResultPresentation(job: ReservationJob) {
  return getResultContent(job);
}

function getResultIcon(tone: "error" | "success" | "warning"): ReactNode {
  if (tone === "success") return <CheckCircle size={28} weight="fill" />;
  if (tone === "warning") return <WarningCircle size={28} weight="fill" />;
  return <XCircle size={28} weight="fill" />;
}

function getCallSummary(job: ReservationJob): string {
  if (job.outcome?.result === "completed") return job.outcome.summary;
  if (job.outcome?.result === "needs_human") return job.outcome.summary ?? job.outcome.reason;
  if (job.status === "confirmed") {
    return `${job.placeName}에서 ${job.partySize}명 예약을 확정했습니다.`;
  }
  return `${job.placeName}에 전화를 시도했지만 업무를 완료하지 못했습니다. 최종 처리 결과를 확인해주세요.`;
}
