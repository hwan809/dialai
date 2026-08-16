type ProgressStep = {
  readonly id: string;
  readonly label: string;
};

type ProgressRailProps = {
  readonly currentId: string;
  readonly steps: readonly ProgressStep[];
};

export function ProgressRail({ currentId, steps }: ProgressRailProps) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === currentId));
  return (
    <ol className="progress-rail" aria-label="전화 진행 단계">
      {steps.map((step, index) => {
        const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
        return (
          <li
            key={step.id}
            className={`progress-step progress-step--${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="progress-step__index" aria-hidden>
              {index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
