"use client";

import { Ban, Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, type ModerationCase, apiFetch } from "../lib/api";
import { Button, Card, EmptyState, StatusPill, useToast } from "./ui";

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
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, done: string, action: () => Promise<unknown>) {
    setBusy(id);
    try {
      await action();
      push(done);
      router.refresh();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Action failed.", "danger");
    } finally {
      setBusy(null);
    }
  }

  if (cases.length === 0) {
    return <EmptyState body="Player and venue reports appear here." title="No open reports" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cases.map((item) => {
        const isBusy = busy === item.id;
        return (
          <Card className="flex flex-col gap-2 p-5" key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <strong className="text-ink-900">{item.subjectType} report</strong>
              <StatusPill status={item.status} />
            </div>
            <p className="m-0 text-sm text-ink-700">{item.reason}</p>
            <p className="m-0 text-sm text-ink-500">
              subject {item.subjectId} — {formatWhen(item.createdAt)}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {SUSPENDABLE.has(item.subjectType) ? (
                <Button
                  disabled={isBusy}
                  onClick={() =>
                    run(item.id, "Subject suspended.", () =>
                      apiFetch("/moderation/subjects/suspend", {
                        method: "POST",
                        body: { subjectType: item.subjectType, subjectId: item.subjectId },
                      }),
                    )
                  }
                  size="sm"
                  variant="secondary"
                >
                  <Ban aria-hidden="true" size={16} /> Suspend
                </Button>
              ) : null}
              {SUSPENDABLE.has(item.subjectType) ? (
                <Button
                  disabled={isBusy}
                  onClick={() =>
                    run(item.id, "Subject reinstated.", () =>
                      apiFetch("/moderation/subjects/reinstate", {
                        method: "POST",
                        body: { subjectType: item.subjectType, subjectId: item.subjectId },
                      }),
                    )
                  }
                  size="sm"
                  variant="secondary"
                >
                  <RotateCcw aria-hidden="true" size={16} /> Reinstate
                </Button>
              ) : null}
              <Button
                loading={isBusy}
                onClick={() => {
                  const resolution = window.prompt("Resolution note?");
                  if (!resolution) return;
                  void run(item.id, "Report resolved.", () =>
                    apiFetch("/moderation/cases/resolve", {
                      method: "POST",
                      body: { caseId: item.id, status: "RESOLVED", resolution },
                    }),
                  );
                }}
                size="sm"
              >
                <Check aria-hidden="true" size={16} /> Resolve
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => {
                  const resolution = window.prompt("Why dismiss this report?");
                  if (!resolution) return;
                  void run(item.id, "Report dismissed.", () =>
                    apiFetch("/moderation/cases/resolve", {
                      method: "POST",
                      body: { caseId: item.id, status: "DISMISSED", resolution },
                    }),
                  );
                }}
                size="sm"
                variant="ghost"
              >
                <X aria-hidden="true" size={14} /> Dismiss
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
