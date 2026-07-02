import type { ReactNode } from "react";
import { CourtLines } from "./court-lines";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-(--radius-card) border border-dashed border-sand-300 px-6 py-12 text-center">
      <CourtLines className="w-24 text-court-200" variant="corner" />
      <p className="m-0 font-display text-lg font-semibold text-ink-900">{title}</p>
      {body ? <p className="m-0 max-w-md text-[0.92rem] text-ink-500">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
