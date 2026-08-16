import { expect, it } from "vitest";
import { assertLiveCallAllowed } from "./live-call-smoke";

it("requires an explicit opt-in and destination before a live call", () => {
  expect(() => assertLiveCallAllowed({ RUN_LIVE_CALL: "false", LIVE_CALL_TO: "01012345678" })).toThrow();
  expect(() => assertLiveCallAllowed({ RUN_LIVE_CALL: "true" })).toThrow();
  expect(assertLiveCallAllowed({ RUN_LIVE_CALL: "true", LIVE_CALL_TO: "010-1234-5678" })).toBe("01012345678");
});
