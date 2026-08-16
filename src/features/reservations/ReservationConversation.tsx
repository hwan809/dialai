"use client";

import { ArrowUp, CheckCircle, Microphone, PhoneCall, Sparkle, Stop } from "@phosphor-icons/react";
import ky from "ky";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button, IconButton } from "@/components/ui/Button";
import { formatKoreanDateTime, formatKoreanPhoneNumber } from "./schema";
import type {
  ReservationConversationMessage,
  ReservationConversationResult,
} from "./conversation";
import type { CreateReservationInput } from "./types";
import { useSpeechInput } from "./use-speech-input";

type DisplayMessage = ReservationConversationMessage & { readonly id: string };

type ReservationConversationProps = {
  readonly onStart: (input: CreateReservationInput) => void;
  readonly submitting: boolean;
};

const welcomeMessage: DisplayMessage = {
  content: "안녕하세요. 예약할 식당과 원하는 일시를 편하게 말씀해주세요. 필요한 내용은 제가 대화로 확인할게요.",
  id: "welcome",
  role: "assistant",
};

const examples = [
  "내일 저녁 7시에 코덱스 식당 두 명 예약해줘",
  "이번 주 토요일 점심에 가족 4명 예약하고 싶어",
  "오늘 저녁 조용한 자리로 식당 예약해줘",
] as const;

export function ReservationConversation({ onStart, submitting }: ReservationConversationProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ReservationConversationResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeechInput((transcript) => {
    setInput((current) => [current, transcript].filter(Boolean).join(" "));
  });

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (content.length === 0 || sending || submitting) return;

    const userMessage: DisplayMessage = { content, id: crypto.randomUUID(), role: "user" };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setResult(null);
    setError(null);
    setSending(true);

    try {
      const reply = await ky.post("/api/reservations/chat", {
        json: {
          messages: nextMessages.map(({ content: messageContent, role }) => ({
            content: messageContent,
            role,
          })),
        },
      }).json<ReservationConversationResult>();
      setMessages((current) => [
        ...current,
        { content: reply.reply, id: crypto.randomUUID(), role: "assistant" },
      ]);
      setResult(reply);
    } catch {
      setError("대화를 처리하지 못했습니다. 잠시 후 다시 보내주세요.");
    } finally {
      setSending(false);
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const confirmCall = () => {
    if (result?.input === null || result?.input === undefined || !result.ready) return;
    onStart({
      ...result.input,
      idempotencyKey: `web-${crypto.randomUUID()}`,
    });
  };

  const hasUserMessage = messages.some((message) => message.role === "user");

  return (
    <section className="reservation-chat" aria-labelledby="reservation-chat-heading">
      <header className="reservation-chat__header">
        <p className="screen-kicker">AI 전화 대행</p>
        <h1 id="reservation-chat-heading" className="screen-title">채팅으로 예약 내용을 알려주세요.</h1>
        <p className="screen-description">정보가 모두 확인된 뒤에만 실제 전화 요청 버튼이 나타납니다.</p>
      </header>

      <div className="conversation-thread" aria-live="polite">
        {messages.map((message) => message.role === "user" ? (
          <article key={message.id} className="chat-message chat-message--user">
            <p>{message.content}</p>
          </article>
        ) : (
          <article key={message.id} className="chat-message chat-message--assistant">
            <span className="assistant-avatar" aria-hidden><PhoneCall size={17} weight="fill" /></span>
            <div className="assistant-message__content"><p>{message.content}</p></div>
          </article>
        ))}

        {sending && (
          <article className="chat-message chat-message--assistant" aria-label="답변 작성 중">
            <span className="assistant-avatar" aria-hidden><PhoneCall size={17} weight="fill" /></span>
            <div className="assistant-message__content"><p className="chat-thinking">예약 정보를 확인하고 있어요…</p></div>
          </article>
        )}

        {result?.ready && result.input !== null && (
          <article className="chat-confirmation">
            <div className="chat-confirmation__heading">
              <CheckCircle size={22} weight="fill" />
              <div><strong>전화할 정보를 모두 확인했어요.</strong><span>버튼을 누르기 전에는 전화하지 않습니다.</span></div>
            </div>
            <dl className="detail-grid">
              <Detail label="매장" value={result.input.placeName} />
              <Detail label="전화번호" value={formatKoreanPhoneNumber(result.input.destinationPhone)} />
              <Detail label="예약 일시" value={formatKoreanDateTime(result.input.requestedAt)} />
              <Detail label="인원" value={`${result.input.partySize}명`} />
              <Detail label="예약자" value={result.input.customerName} />
              <Detail label="추가 요청" value={result.input.requestNotes ?? "없음"} />
            </dl>
            <p className="chat-confirmation__hint">수정할 내용이 있으면 아래 채팅에 그대로 말씀해주세요.</p>
            <Button leadingIcon={<PhoneCall size={18} />} onClick={confirmCall} loading={submitting}>
              {submitting ? "전화 작업 등록 중" : "확인하고 전화 요청"}
            </Button>
          </article>
        )}
      </div>

      {!hasUserMessage && (
        <div className="suggestion-list" aria-label="예약 요청 예시">
          {examples.map((example) => <button key={example} type="button" onClick={() => void sendMessage(example)}>{example}</button>)}
        </div>
      )}

      {error !== null && <p className="field-error form-alert" role="alert">{error}</p>}

      <form className="chat-composer conversation-composer" onSubmit={submitMessage}>
        <label htmlFor="reservation-message" className="sr-only">예약 요청 메시지</label>
        <textarea
          id="reservation-message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage(input);
            }
          }}
          placeholder="예약 내용을 입력하거나, 확인된 내용을 수정해주세요"
          rows={2}
          disabled={sending || submitting}
        />
        <div className="chat-composer__actions">
          <div className="composer-mode"><Sparkle size={17} /> LLM 예약 도우미</div>
          <div className="composer-buttons">
            <IconButton
              onClick={speech.status === "listening" ? speech.stop : speech.start}
              aria-pressed={speech.status === "listening"}
              label={speech.status === "listening" ? "음성 입력 중지" : "마이크로 말하기"}
              disabled={sending || submitting}
            >
              {speech.status === "listening" ? <Stop size={20} weight="fill" /> : <Microphone size={20} />}
            </IconButton>
            <button className="composer-send" type="submit" disabled={input.trim().length === 0 || sending || submitting} aria-label="메시지 보내기">
              <ArrowUp size={20} weight="bold" />
            </button>
          </div>
        </div>
      </form>
      <p className="speech-support" role="status">{getSpeechMessage(speech.status)}</p>
    </section>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return <div className="detail-item"><dt className="detail-item__label">{label}</dt><dd className="detail-item__value">{value}</dd></div>;
}

function getSpeechMessage(status: "error" | "idle" | "listening" | "unsupported"): string {
  switch (status) {
    case "error": return "음성 인식에 실패했습니다. 마이크 권한을 확인해주세요.";
    case "listening": return "듣고 있습니다. 예약 내용을 말씀해주세요.";
    case "unsupported": return "이 브라우저에서는 텍스트로 요청을 입력해주세요.";
    case "idle": return "Enter를 누르면 메시지를 보냅니다.";
  }
}
