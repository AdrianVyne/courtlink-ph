import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-(--radius-card) border border-sand-200 bg-white ${className}`.trim()}
      {...props}
    />
  );
}
