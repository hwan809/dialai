"use client";

import { PaperPlaneTilt, PhoneX } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceQuestion } from "@/components/ui/ChoiceQuestion";
import { Field } from "@/components/ui/Field";
import { ProgressRail } from "@/components/ui/ProgressRail";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { StatusTone } from "@/components/ui/StatusBadge";
import { Surface } from "@/components/ui/Surface";
import { Transcript } from "@/components/ui/Transcript";
import { formatKoreanPhoneNumber } from "./schema";
import type { ReservationJob, ReservationStatus, UserCallResponse } from "./types";

const statusContent = {
  ars: { label: "ARS 메뉴를 진행하고 있어요", tone: "info" },
  canceled: { label: "전화 요청이 취소됐어요", tone: "error" },
  confirmed: { label: "요청한 업무를 처리했어요", tone: "success" },
  connected: { label: "상담사와 통화 중이에요", tone: "success" },
  dialing: { label: "전화를 연결하고 있어요", tone: "info" },
  failed: { label: "업무를 완료하지 못했어요", tone: "error" },
  needs_human: { label: "직접 확인이 필요해요", tone: "warning" },
  needs_user_input: { label: "사용자의 확인이 필요해요", tone: "warning" },
  queued: { label: "전화 내용을 확인하고 있어요", tone: "neutral" },
  retry_scheduled: { label: "다시 전화할 준비를 하고 있어요", tone: "warning" },
  unavailable: { label: "요청 가능한 시간을 찾지 못했어요", tone: "warning" },
  waiting: { label: "상담사 연결을 기다리고 있어요", tone: "warning" },
} as const satisfies Record<ReservationStatus, { readonly label: string; readonly tone: StatusTone }>;

const callSteps = [
  { id: "queued", label: "요청 확인" },
  { id: "dialing", label: "전화 연결" },
  { id: "ars", label: "ARS 진행" },
  { id: "waiting", label: "상담사 대기" },
  { id: "connected", label: "상담 진행" },
] as const;

const liveChoices = [
  { id: "accept_alternative", label: "오후 7시 30분으로 예약" },
  { id: "stop_request", label: "이번 예약은 진행하지 않기" },
] as const;

type ReservationProgressProps = {
  readonly demoMode: boolean;
  readonly job: ReservationJob;
  readonly onCancel: () => void;
  readonly onRespond: (response: UserCallResponse) => void;
};

export function ReservationProgress({ demoMode, job, onCancel, onRespond }: ReservationProgressProps) {
  const [instruction, setInstruction] = useState("");
  const [savedInstruction, setSavedInstruction] = useState<string | null>(null);
  const cancelable = job.status === "queued" || job.status === "retry_scheduled";
  const status = statusContent[job.status];

  const saveInstruction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = instruction.trim();
    if (trimmed.length === 0 || !demoMode) return;
    setSavedInstruction(trimmed);
    setInstruction("");
  };

  const answerQuestion = (choiceId: string) => {
    const choice = liveChoices.find((option) => option.id === choiceId);
    if (choice === undefined) return;
    onRespond({ choiceId: choice.id, label: choice.label });
  };

  return (
    <main className="live-shell" aria-labelledby="progress-heading">
      <header className="live-shell__header">
        <div className="call-heading">
          <div>
            <p className="screen-kicker">실시간 통화</p>
            <h1 id="progress-heading" className="screen-title">{job.placeName}</h1>
            <p className="call-meta">
              <span>{formatKoreanPhoneNumber(job.destinationPhone)}</span>
              <span>경과 {formatElapsed(job.createdAt, job.updatedAt)}</span>
            </p>
          </div>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <ProgressRail currentId={getCurrentStep(job.status)} steps={callSteps} />
      </header>

      <div className="live-shell__body">
        <Surface className="transcript-panel">
          <div className="section-heading">
            <h2>실시간 통화 내용</h2>
            <p>상대방과 DialAI의 대화를 순서대로 보여드려요.</p>
          </div>
          <Transcript messages={job.transcript} />
        </Surface>
      </div>

      <footer className="live-shell__dock">
        {job.status === "needs_user_input" && (
          <Surface tone="warning" className="live-confirmation">
            <ChoiceQuestion
              question="상담사가 오후 7시 30분을 제안했습니다."
              description="원하는 답을 선택하면 DialAI가 바로 통화를 이어갑니다."
              options={liveChoices}
              selectedId={null}
              onChange={answerQuestion}
            />
          </Surface>
        )}
        {savedInstruction !== null && (
          <p className="instruction-confirmation" role="status">데모 지시 저장: {savedInstruction}</p>
        )}
        <form className="instruction-form" onSubmit={saveInstruction}>
          <Field
            htmlFor="live-instruction"
            label="통화 중 추가 지시"
            help={demoMode ? "데모에서는 화면에 저장되며 실제 전화로 전송되지는 않습니다." : "전화 워커의 사용자 개입 API가 연결되면 사용할 수 있습니다."}
          >
            <input
              id="live-instruction"
              className="field-control"
              value={instruction}
              disabled={!demoMode}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="예: 창가 자리가 없으면 조용한 자리로 부탁해줘"
            />
          </Field>
          <Button type="submit" variant="secondary" leadingIcon={<PaperPlaneTilt size={18} />} disabled={!demoMode || instruction.trim().length === 0}>지시 저장</Button>
          {cancelable && <Button variant="danger" leadingIcon={<PhoneX size={18} />} onClick={onCancel}>요청 취소</Button>}
        </form>
      </footer>
    </main>
  );
}

function getCurrentStep(status: ReservationStatus): string {
  switch (status) {
    case "queued":
    case "retry_scheduled": return "queued";
    case "dialing": return "dialing";
    case "ars": return "ars";
    case "waiting": return "waiting";
    case "connected":
    case "needs_user_input":
    case "confirmed":
    case "unavailable":
    case "needs_human":
    case "failed":
    case "canceled": return "connected";
  }
}

function formatElapsed(createdAt: string, updatedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.parse(updatedAt) - Date.parse(createdAt)) / 1_000));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}
