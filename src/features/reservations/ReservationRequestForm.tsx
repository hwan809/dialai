"use client";

import { ArrowUp, Microphone, PhoneCall, Sparkle, Stop } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { ReservationDetailsFields } from "./ReservationDetailsFields";
import type { ReservationDraft } from "./ReservationDetailsFields";
import { createReservationInputSchema } from "./schema";
import type { CreateReservationInput } from "./types";
import { useSpeechInput } from "./use-speech-input";

type ReservationRequestFormProps = {
  readonly onReview: (input: CreateReservationInput) => void;
};

const initialDraft: ReservationDraft = {
  customerName: "",
  destinationPhone: "",
  partySize: "2",
  placeName: "",
  requestNotes: "",
  requestedAt: "",
};

const examples = [
  "오늘 저녁 7시에 두 명 예약해줘",
  "주말 점심에 창가 자리 가능한지 물어봐줘",
  "내일 저녁 조용한 자리로 예약해줘",
] as const;

export function ReservationRequestForm({ onReview }: ReservationRequestFormProps) {
  const [conversationStarted, setConversationStarted] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [requestText, setRequestText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeechInput((transcript) => {
    setRequestText((current) => [current, transcript].filter(Boolean).join(" "));
  });

  const startConversation = (message: string) => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return;
    setRequestText(trimmed);
    setConversationStarted(true);
  };

  const handleComposerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startConversation(requestText);
  };

  const handleDetailsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedDate = new Date(draft.requestedAt);
    if (Number.isNaN(requestedDate.getTime())) {
      setError("예약 일시를 입력해주세요.");
      return;
    }
    const requestNotes = [requestText.trim(), draft.requestNotes.trim()].filter(Boolean).join("\n");
    const result = createReservationInputSchema.safeParse({
      ...draft,
      idempotencyKey: `web-${crypto.randomUUID()}`,
      partySize: Number(draft.partySize),
      requestNotes: requestNotes.length > 0 ? requestNotes : undefined,
      requestedAt: requestedDate.toISOString(),
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "입력 내용을 확인해주세요.");
      return;
    }
    setError(null);
    onReview(result.data);
  };

  if (!conversationStarted) {
    return (
      <section className="chatbot-empty" aria-labelledby="request-heading">
        <div className="chatbot-empty__intro">
          <span className="chatbot-symbol" aria-hidden><PhoneCall size={26} weight="fill" /></span>
          <p>AI 전화 대행</p>
          <h1 id="request-heading">어떤 예약 전화를 대신 처리해드릴까요?</h1>
          <span>식당 예약 요청을 편하게 말해주세요. 필요한 내용은 제가 이어서 물어볼게요.</span>
        </div>

        <form className="chat-composer" onSubmit={handleComposerSubmit}>
          <label htmlFor="request-text" className="sr-only">전화 요청</label>
          <textarea
            id="request-text"
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                startConversation(requestText);
              }
            }}
            placeholder="예: 오늘 저녁 7시에 두 명 예약해줘"
            rows={3}
          />
          <div className="chat-composer__actions">
            <div className="composer-mode"><Sparkle size={17} /> 전화 대행</div>
            <div className="composer-buttons">
              <IconButton
                onClick={speech.status === "listening" ? speech.stop : speech.start}
                aria-pressed={speech.status === "listening"}
                label={speech.status === "listening" ? "음성 입력 중지" : "마이크로 말하기"}
              >
                {speech.status === "listening" ? <Stop size={20} weight="fill" /> : <Microphone size={20} />}
              </IconButton>
              <button className="composer-send" type="submit" disabled={requestText.trim().length === 0} aria-label="요청 보내기">
                <ArrowUp size={20} weight="bold" />
              </button>
            </div>
          </div>
        </form>

        <div className="suggestion-list" aria-label="전화 요청 예시">
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => startConversation(example)}>{example}</button>
          ))}
        </div>
        <p className="speech-support" role="status">{getSpeechMessage(speech.status)}</p>
      </section>
    );
  }

  return (
    <section className="conversation-stage" aria-labelledby="conversation-heading">
      <h1 id="conversation-heading" className="sr-only">전화 요청 대화</h1>
      <div className="conversation-thread">
        <article className="chat-message chat-message--user">
          <p>{requestText}</p>
        </article>

        <article className="chat-message chat-message--assistant">
          <span className="assistant-avatar" aria-hidden><PhoneCall size={17} weight="fill" /></span>
          <div className="assistant-message__content">
            <p><strong>좋아요. 제가 대신 전화할게요.</strong></p>
            <p>전화를 정확히 처리하려면 아래 정보가 필요해요. 입력이 끝나면 통화 내용을 한 번 더 확인해드릴게요.</p>
            <form className="assistant-task-card" onSubmit={handleDetailsSubmit}>
              <ReservationDetailsFields draft={draft} onChange={setDraft} />
              {error !== null && <p role="alert" className="field-error form-alert">{error}</p>}
              <div className="assistant-task-card__actions">
                <Button type="button" variant="secondary" onClick={() => setConversationStarted(false)}>요청 다시 쓰기</Button>
                <Button type="submit">내용 확인하기</Button>
              </div>
            </form>
          </div>
        </article>
      </div>
    </section>
  );
}

function getSpeechMessage(status: "error" | "idle" | "listening" | "unsupported"): string {
  switch (status) {
    case "error": return "음성 인식에 실패했습니다. 마이크 권한을 확인해주세요.";
    case "listening": return "듣고 있습니다. 요청을 말씀해주세요.";
    case "unsupported": return "이 브라우저에서는 텍스트로 요청을 입력해주세요.";
    case "idle": return "Enter를 누르면 요청을 시작합니다.";
  }
}
