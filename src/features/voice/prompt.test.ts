import { expect, it } from "vitest";

import { buildPhoneCallPrompt } from "./prompt";

const job = {
  id: "call_123",
  destinationPhone: "01012345678",
  objective: "내일 영업시간과 주차 가능 여부를 확인해 주세요.",
  context: "고객은 오후 방문을 고려 중입니다.",
  successCriteria: ["영업시간", "주차 가능 여부"],
};

it("builds a Korean AI-disclosure prompt with the complete call request in a data block", () => {
  const prompt = buildPhoneCallPrompt(job);

  expect(prompt).toMatch(/^첫 문장에서 고객을 대신해 전화한 AI 도우미라고 밝히세요\./);
  expect(prompt).toContain("record_call_outcome 도구를 정확히 한 번 호출하세요");
  expect(prompt).toContain("추측하지 마세요");
  expect(prompt).toContain("hang_up 도구로 통화를 종료하세요");

  const jsonBlock = prompt.match(/```json\n([\s\S]+?)\n```/)?.[1];
  expect(jsonBlock).toBeDefined();
  expect(JSON.parse(jsonBlock ?? "")).toEqual({
    objective: "내일 영업시간과 주차 가능 여부를 확인해 주세요.",
    context: "고객은 오후 방문을 고려 중입니다.",
    successCriteria: ["영업시간", "주차 가능 여부"],
  });
});
