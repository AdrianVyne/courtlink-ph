"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { ApiError, apiFetch } from "../lib/api";

type SubjectType = "VENUE" | "COACH" | "REVIEW";

export function ReportButton({
  subjectType,
  subjectId,
}: {
  subjectType: SubjectType;
  subjectId: string;
}) {
  const [state, setState] = useState<"idle" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function report() {
    const reason = window.prompt("What's wrong with this listing?");
    if (!reason || reason.trim().length < 4) return;
    setError(null);
    try {
      await apiFetch("/moderation/reports", {
        method: "POST",
        body: { subjectType, subjectId, reason },
      });
      setState("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the report.");
    }
  }

  if (state === "done") {
    return <span className="text-[0.85rem] text-ink-500">Report submitted. Thank you.</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        className="inline-flex cursor-pointer items-center gap-[0.3rem] text-[0.9rem] font-semibold text-danger-fg"
        type="button"
        onClick={report}
      >
        <Flag size={14} aria-hidden="true" /> Report
      </button>
      {error ? (
        <span
          className="m-0 rounded-[10px] border border-[#f1b5b0] bg-danger-bg px-[0.8rem] py-[0.6rem] text-[0.88rem] text-danger-fg"
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}
