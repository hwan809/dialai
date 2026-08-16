import { afterEach, describe, expect, it, vi } from "vitest";

const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  vi.resetModules();
});

describe("getOpenAI", () => {
  it("빌드 중에는 키를 요구하지 않고 실제 요청 시 명확한 오류를 낸다", async () => {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();

    const openAiModule = await import("./openai");

    expect(() => openAiModule.getOpenAI()).toThrow("OPENAI_API_KEY");
  });
});
