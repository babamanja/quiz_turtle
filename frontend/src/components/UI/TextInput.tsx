import { useId, useState } from "react";

import "./style.scss";

type TextInputBaseProps = {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  id?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
};

type TextInputProps = TextInputBaseProps & {
  type?: "text" | "password";
};

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4" />
      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c7 0 10 7 10 7a16.9 16.9 0 0 1-3.2 4.4" />
      <path d="M6.6 6.6A16.8 16.8 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.8" />
    </svg>
  );
}

export default function TextInput({
  label,
  value,
  onChange,
  type = "text",
  id: idProp,
  autoComplete,
  disabled,
  required,
  minLength,
  placeholder,
  showPasswordLabel = "Show password",
  hidePasswordLabel = "Hide password",
}: TextInputProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const inputType = type === "password" ? (isPasswordVisible ? "text" : "password") : "text";

  const input = (
    <input
      id={inputId}
      type={inputType}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="text-input"
      autoComplete={autoComplete}
      disabled={disabled}
      required={required}
      minLength={minLength}
      placeholder={placeholder}
    />
  );

  return (
    <label className="text-input-label" htmlFor={inputId}>
      {label}
      {type === "password" ? (
        <div className="text-input-wrap">
          {input}
          <button
            type="button"
            className="text-input-toggle"
            disabled={disabled}
            aria-label={isPasswordVisible ? hidePasswordLabel : showPasswordLabel}
            onClick={() => setIsPasswordVisible((prev) => !prev)}
          >
            {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        input
      )}
    </label>
  );
}
