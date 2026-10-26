import { useId } from "react";

type Props = {
  label: string;
  name: string;
  type?: string;
  value: string;
  error?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
};

export function TextField({ label, name, type = "text", value, error, autoComplete, onChange }: Props) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}