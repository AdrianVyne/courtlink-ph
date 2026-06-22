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
    return <span className="report-done">Report submitted. Thank you.</span>;
  }

  return (
    <span className="report-wrap">
      <button className="text-button report-button" type="button" onClick={report}>
        <Flag size={14} aria-hidden="true" /> Report
      </button>
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
