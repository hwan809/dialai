import { expect, it } from "vitest";

import { assertDialAiTools, validateMcpHealthUrl } from "./mcp-health";

it("accepts only a complete DialAI phone-call tool set", () => {
  expect(() => assertDialAiTools([
    "create_phone_call",
    "get_phone_call",
    "list_phone_calls",
    "cancel_phone_call",
  ])).not.toThrow();

  expect(() => assertDialAiTools([
    "get_phone_call",
    "list_phone_calls",
    "cancel_phone_call",
  ])).toThrow("create_phone_call");
});

it.each([
  "http://dialai.example/mcp",
  "https://user:password@dialai.example/mcp",
  "https://dialai.example/mcp#fragment",
])("refuses unsafe health-check URL %s before sending a bearer token", (value) => {
  expect(() => validateMcpHealthUrl(value)).toThrow();
});

it("accepts an HTTPS public health-check URL and a loopback HTTP URL", () => {
  expect(validateMcpHealthUrl("https://dialai.example/mcp").toString()).toBe("https://dialai.example/mcp");
  expect(validateMcpHealthUrl("http://127.0.0.1:3000/mcp").toString()).toBe("http://127.0.0.1:3000/mcp");
});
