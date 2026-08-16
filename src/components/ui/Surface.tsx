import type { ReactNode } from "react";

type SurfaceTone = "default" | "error" | "subtle" | "success" | "warning";

type SurfaceProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: SurfaceTone;
};

export function Surface({ children, className = "", tone = "default" }: SurfaceProps) {
  const toneClass = tone === "default" ? "" : `ui-surface--${tone}`;
  return (
    <div className={`ui-surface ${toneClass} ${className}`.trim()}>
      <div className="ui-surface__body">{children}</div>
    </div>
  );
}
