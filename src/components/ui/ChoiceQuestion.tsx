type ChoiceOption = {
  readonly id: string;
  readonly label: string;
};

type ChoiceQuestionProps = {
  readonly description: string;
  readonly disabled?: boolean;
  readonly onChange: (id: string) => void;
  readonly options: readonly ChoiceOption[];
  readonly question: string;
  readonly selectedId: string | null;
};

export function ChoiceQuestion({
  description,
  disabled = false,
  onChange,
  options,
  question,
  selectedId,
}: ChoiceQuestionProps) {
  return (
    <fieldset className="choice-question">
      <legend className="choice-question__legend">{question}</legend>
      <p className="choice-question__description">{description}</p>
      <div className="choice-question__options">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="choice-option"
            aria-pressed={selectedId === option.id}
            disabled={disabled}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
