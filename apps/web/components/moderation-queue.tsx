"use client";

import { Ban, Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, type ModerationCase, apiFetch } from "../lib/api";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

const SUSPENDABLE = new Set(["VENUE", "COACH", "USER"]);

export function ModerationQueue({ cases }: { cases: ModerationCase[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (cases.length === 0) {
    return <p className="empty-state">No open reports.</p>;
  }

  return (
    <div className="queue-list">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {cases.map((item) => {
        const isBusy = busy === item.id;
        return (
          <article className="queue-card" key={item.id}>
            <div className="queue-head">
              <strong>{item.subjectType} report</strong>
              <span className={`status-pill status-${item.status.toLowerCase()}`}>
                {item.status}
              </span>
            </div>
            <p className="queue-when">{item.reason}</p>
            <p className="review-when">
              subject {item.subjectId} - {formatWhen(item.createdAt)}
            </p>
            <div className="queue-actions">
              {SUSPENDABLE.has(item.subjectType) ? (
                <button
                  className="button button-secondary button-small"
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    run(item.id, () =>
                      apiFetch("/moderation/subjects/suspend", {
                        method: "POST",
                        body: { subjectType: item.subjectType, subjectId: item.subjectId },
                      }),
                    )
                  }
                >
                  <Ban size={16} aria-hidden="true" /> Suspend
                </button>
              ) : null}
              {SUSPENDABLE.has(item.subjectType) ? (
                <button
                  className="button button-secondary button-small"
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    run(item.id, () =>
                      apiFetch("/moderation/subjects/reinstate", {
                        method: "POST",
                        body: { subjectType: item.subjectType, subjectId: item.subjectId },
                      }),
                    )
                  }
                >
                  <RotateCcw size={16} aria-hidden="true" /> Reinstate
                </button>
              ) : null}
              <button
                className="button button-small"
                type="button"
                disabled={isBusy}
                onClick={() => {
                  const resolution = window.prompt("Resolution note?");
                  if (!resolution) return;
                  void run(item.id, () =>
                    apiFetch("/moderation/cases/resolve", {
                      method: "POST",
                      body: { caseId: item.id, status: "RESOLVED", resolution },
                    }),
                  );
                }}
              >
                <Check size={16} aria-hidden="true" /> Resolve
              </button>
              <button
                className="text-button"
                type="button"
                disabled={isBusy}
                onClick={() => {
                  const resolution = window.prompt("Why dismiss this report?");
                  if (!resolution) return;
                  void run(item.id, () =>
                    apiFetch("/moderation/cases/resolve", {
                      method: "POST",
                      body: { caseId: item.id, status: "DISMISSED", resolution },
                    }),
                  );
                }}
              >
                <X size={14} aria-hidden="true" /> Dismiss
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
