import type { ReactNode } from "react";

export type StatusTone = "error" | "info" | "neutral" | "success" | "warning";

type StatusBadgeProps = {
  readonly children: ReactNode;
  readonly tone?: StatusTone;
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  const toneClass = tone === "neutral" ? "" : `status-badge--${tone}`;
  return <span className={`status-badge ${toneClass}`.trim()}>{children}</span>;
}
