"use client";

import {
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  cloneElement,
  useId,
} from "react";

const controlClasses =
  "min-h-11 rounded-(--radius-control) border border-sand-200 bg-white px-3.5 text-ink-900 " +
  "focus:border-court-700 focus:outline-2 focus:outline-court-700/30 focus:outline-offset-1";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClasses} ${className}`.trim()} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClasses} ${className}`.trim()} {...props} />;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
  }>;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const controlProps: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: "true";
  } = { id: controlId };
  if (describedBy) controlProps["aria-describedby"] = describedBy;
  if (error) controlProps["aria-invalid"] = "true";
  const control = cloneElement(children, controlProps);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-ink-700" htmlFor={controlId}>
        {label}
      </label>
      {control}
      {hint ? (
        <p className="m-0 text-[0.82rem] text-ink-500" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-[0.82rem] font-medium text-danger-fg" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
