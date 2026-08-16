import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import {
  reservationConversationModelOutputSchema,
  type ReservationConversationMessage,
  type ReservationConversationModelOutput,
} from "./conversation";

export async function completeReservationConversation(
  messages: readonly ReservationConversationMessage[],
): Promise<ReservationConversationModelOutput> {
  const now = new Date();
  const { output } = await generateText({
    model: openai("gpt-4.1-mini"),
    output: Output.object({ schema: reservationConversationModelOutputSchema }),
    system: `당신은 한국 식당 예약 전화 접수 도우미입니다.
현재 시각은 ${now.toISOString()}이며 사용자의 시간대는 Asia/Seoul입니다.
자연스러운 한국어 대화로 아래 정보를 수집하세요: 매장명, 국내 전화번호, 예약 일시, 인원, 예약자명. 추가 요청은 선택입니다.
한 번에 이미 말한 내용을 다시 묻지 말고, 누락되거나 모호한 정보만 짧게 질문하세요.
상대적인 날짜(오늘, 내일, 이번 주말)는 현재 시각 기준으로 해석하고 requestedAt은 반드시 timezone이 포함된 ISO 8601 문자열로 반환하세요.
추측하지 마세요. 사용자가 정정하면 최신 값을 사용하세요.
모든 필수 정보가 모이면 reply에서 아래 내용을 확인하고 전화 요청 버튼을 누르라고 안내하세요.
reply는 마크다운 없이 간결한 일반 문장으로 작성하세요. reservation에는 지금까지 확인된 값만 넣고, 아직 모르는 값은 null로 두세요.`,
    messages: messages.map((message) => ({
      content: message.content,
      role: message.role,
    })),
  });

  return output;
}
