import type { ReactNode } from "react";
export function Field({
  label,
  value,
  onChange,
  placeholder = "",
  multiline = false,
  hint,
  maxLength = 150,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  maxLength?: number;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <i> *</i>}
      </span>
      {multiline ? (
        <textarea
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={4}
          required={required}
        />
      ) : (
        <input
          aria-label={label}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function FormRow({ children }: { children: ReactNode }) {
  return <div className="form-row">{children}</div>;
}
