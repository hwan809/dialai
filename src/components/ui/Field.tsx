import type { ReactNode } from "react";

type FieldProps = {
  readonly children: ReactNode;
  readonly error?: string;
  readonly help?: string;
  readonly htmlFor: string;
  readonly label: string;
};

export function Field({ children, error, help, htmlFor, label }: FieldProps) {
  return (
    <div className="field-stack">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error !== undefined ? (
        <p className="field-error">{error}</p>
      ) : help !== undefined ? (
        <p className="field-help">{help}</p>
      ) : null}
    </div>
  );
}
