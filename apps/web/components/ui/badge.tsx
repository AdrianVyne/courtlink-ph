import type { HTMLAttributes } from "react";

export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700 ${className}`.trim()}
      {...props}
    />
  );
}
