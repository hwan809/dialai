import { describe, expect, it } from "vitest";

import { classifyRetry } from "./retry-policy";

describe.each([
  ["no-answer", 1, true],
  ["busy", 1, true],
  ["failed", 1, true],
  ["provider_exception", 1, true],
  ["rejected", 1, false],
  ["invalid_number", 1, false],
  ["number_changed", 1, false],
  ["incompatible_destination", 1, false],
  ["no-answer", 2, false],
])("classifyRetry(%s, %i)", (reason, attemptCount, retry) => {
  it(`returns retry=${retry}`, () => {
    expect(
      classifyRetry(reason, attemptCount, new Date("2026-08-16T00:00:00Z")),
    ).toEqual(
      retry
        ? { retry: true, retryAt: "2026-08-16T00:10:00.000Z" }
        : { retry: false, retryAt: null },
    );
  });
});
