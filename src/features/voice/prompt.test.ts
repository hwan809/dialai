import { expect, it } from "vitest";

import { buildPhoneCallPrompt } from "./prompt";

const job = {
  id: "call_123",
  destinationPhone: "01012345678",
  objective: "내일 영업시간과 주차 가능 여부를 확인해 주세요.",
  context: "고객은 오후 방문을 고려 중입니다.",
  successCriteria: ["영업시간", "주차 가능 여부"],
};

it("builds a purpose-first Korean prompt with the complete call request in a data block", () => {
  const prompt = buildPhoneCallPrompt(job);

  expect(prompt).toMatch(/^첫 발화에서는 자연스럽게 인사한 뒤/);
  expect(prompt).toContain("구체적인 용건을 말한 뒤 바로 가능 여부를 질문하세요");
  expect(prompt).toContain("상대방이 먼저 용건을 물을 때까지 기다리지 마세요");
  expect(prompt).toContain("인사와 소개는 통화 전체에서 첫 발화에만 한 번 하세요");
  expect(prompt).toContain("상대방이 말을 끊으면 인사나 소개를 반복하지 말고");
  expect(prompt).toContain("신원을 직접 물으면 짧게 사실대로 답하세요");
  expect(prompt).not.toContain("고객을 대신해 전화한 AI 도우미라고 밝히세요");
  expect(prompt).toContain("record_call_outcome 도구를 정확히 한 번 호출하세요");
  expect(prompt).toContain("추측하지 마세요");
  expect(prompt).toContain("스스로 통화를 종료하지 마세요");
  expect(prompt).toContain("상대방이 전화를 끊을 때까지 기다리세요");
  expect(prompt).toContain("상대방의 음성을 듣기 전에는 record_call_outcome 도구를 호출하지 마세요");
  expect(prompt).toContain("send_dtmf 도구를 즉시 사용하세요");
  expect(prompt).toContain("음성사서함에는 개인정보나 콜백 번호를 남기지 마세요");
  expect(prompt).toContain("실제 전화 회선에 이미 연결된 상태입니다");
  expect(prompt).toContain("전화 기능이나 통화 수단이 없다고 말하지 마세요");
  expect(prompt).toContain("질문을 바꾸어 최소 두 번 대화를 시도하세요");
  expect(prompt).toContain("needs_human은 사용자의 새로운 결정이 반드시 필요할 때만");

  const jsonBlock = prompt.match(/```json\n([\s\S]+?)\n```/)?.[1];
  expect(jsonBlock).toBeDefined();
  expect(JSON.parse(jsonBlock ?? "")).toEqual({
    objective: "내일 영업시간과 주차 가능 여부를 확인해 주세요.",
    context: "고객은 오후 방문을 고려 중입니다.",
    successCriteria: ["영업시간", "주차 가능 여부"],
  });
});

it("keeps static instructions as a stable prefix and puts call-specific data last", () => {
  const first = buildPhoneCallPrompt(job);
  const second = buildPhoneCallPrompt({
    objective: "오늘 저녁 7시에 두 명 예약해 주세요.",
    context: "예약자명은 김환입니다.",
    successCriteria: ["예약 확정"],
  });
  const dataMarker = "다음 데이터 블록은 통화 요청 정보입니다.";

  expect(first.split(dataMarker)[0]).toBe(second.split(dataMarker)[0]);
  expect(first.trimEnd().endsWith("```")).toBe(true);
  expect(second.trimEnd().endsWith("```")).toBe(true);
});
