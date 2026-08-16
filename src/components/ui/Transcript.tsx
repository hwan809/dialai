import { ChatsCircle } from "@phosphor-icons/react/dist/ssr";

export type TranscriptMessage = {
  readonly at: string;
  readonly role: "assistant" | "user";
  readonly text: string;
};

type TranscriptProps = {
  readonly emptyMessage?: string;
  readonly messages: readonly TranscriptMessage[];
};

export function Transcript({
  emptyMessage = "연결 후 대화가 표시됩니다.",
  messages,
}: TranscriptProps) {
  if (messages.length === 0) {
    return (
      <div className="transcript-empty">
        <ChatsCircle aria-hidden size={28} />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ol className="transcript-list" aria-live="polite">
      {messages.map((message) => (
        <li
          key={`${message.at}-${message.text}`}
          className={`transcript-item transcript-item--${message.role}`}
        >
          <div className="transcript-item__meta">
            <span className="transcript-item__speaker">
              {message.role === "assistant" ? "DialAI" : "통화 상대방"}
            </span>
            <time>{message.at}</time>
          </div>
          <p className="transcript-item__bubble">{message.text}</p>
        </li>
      ))}
    </ol>
  );
}
