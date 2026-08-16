"use client";

import { ArrowLeft, PhoneCall } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceQuestion } from "@/components/ui/ChoiceQuestion";
import { Surface } from "@/components/ui/Surface";
import { formatKoreanDateTime, formatKoreanPhoneNumber } from "./schema";
import type { CreateReservationInput } from "./types";

type ReservationReviewProps = {
  readonly input: CreateReservationInput;
  readonly onBack: () => void;
  readonly onStart: (input: CreateReservationInput) => void;
  readonly submitting: boolean;
};

const preferenceOptions = [
  { id: "nearby", label: "앞뒤 1시간까지 괜찮아요" },
  { id: "exact", label: "요청한 시간만 가능해요" },
  { id: "ask", label: "가능한 시간을 먼저 확인해주세요" },
] as const;

export function ReservationReview({ input, onBack, onStart, submitting }: ReservationReviewProps) {
  const [preference, setPreference] = useState<string | null>(null);

  const startWithPreference = () => {
    const label = preferenceOptions.find((option) => option.id === preference)?.label;
    if (label === undefined) {
      return;
    }
    const requestNotes = [input.requestNotes, `대안 조건: ${label}`].filter(Boolean).join("\n");
    onStart({ ...input, requestNotes });
  };

  return (
    <section aria-labelledby="review-heading" className="screen-stack">
      <header className="screen-header">
        <p className="screen-kicker">전화 전 확인</p>
        <h1 id="review-heading" className="screen-title">전화하기 전에 내용을 확인할게요.</h1>
        <p className="screen-description">
          아래 조건으로 매장에 전화합니다. 잘못된 내용은 시작 전에 수정할 수 있어요.
        </p>
      </header>

      <Surface>
        <div className="section-heading">
          <h2>AI가 정리한 업무</h2>
          <p>{input.placeName}에 전화해 예약 가능 여부를 확인하고 예약을 요청합니다.</p>
        </div>
        <dl className="detail-grid">
          <Detail label="전화 대상" value={input.placeName} />
          <Detail label="전화번호" value={formatKoreanPhoneNumber(input.destinationPhone)} />
          <Detail label="예약자" value={input.customerName} />
          <Detail label="인원" value={`${input.partySize}명`} />
          <Detail label="예약 일시" value={formatKoreanDateTime(input.requestedAt)} />
          <Detail label="추가 요청" value={input.requestNotes ?? "없음"} />
        </dl>
      </Surface>

      <Surface tone="subtle">
        <ChoiceQuestion
          question="요청한 시간이 어렵다면 어떻게 할까요?"
          description="선택한 조건을 DialAI가 통화 중 우선 적용합니다."
          options={preferenceOptions}
          selectedId={preference}
          onChange={setPreference}
          disabled={submitting}
        />
      </Surface>

      <div className="action-row action-row--end">
        <Button variant="secondary" leadingIcon={<ArrowLeft size={18} />} onClick={onBack}>
          수정하기
        </Button>
        <Button
          leadingIcon={<PhoneCall size={18} />}
          onClick={startWithPreference}
          loading={submitting}
          disabled={preference === null}
        >
          {submitting ? "전화 준비 중" : "전화 시작"}
        </Button>
      </div>
    </section>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="detail-item">
      <dt className="detail-item__label">{label}</dt>
      <dd className="detail-item__value">{value}</dd>
    </div>
  );
}
