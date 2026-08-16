export type RetryDecision =
  | { retry: true; retryAt: string }
  | { retry: false; retryAt: null };

const retryableReasons = new Set([
  "no-answer",
  "busy",
  "failed",
  "provider_exception",
]);

export function classifyRetry(
  reason: string,
  attemptCount: number,
  now: Date,
): RetryDecision {
  if (attemptCount < 2 && retryableReasons.has(reason)) {
    return { retry: true, retryAt: new Date(now.getTime() + 10 * 60_000).toISOString() };
  }

  return { retry: false, retryAt: null };
}
