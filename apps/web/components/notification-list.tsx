"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { type NotificationItem, apiFetch } from "../lib/api";
import { Button, EmptyState } from "./ui";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function NotificationList({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState(false);

  async function markAll() {
    setPending(true);
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      setItems((current) =>
        current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function markOne(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: "POST" });
    setItems((current) =>
      current.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState
        body="Booking updates, proof decisions, and offers will land here."
        title="No notifications yet"
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button loading={pending} onClick={markAll} size="sm" variant="secondary">
          Mark all read
        </Button>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((n) => (
          <li key={n.id}>
            <button
              className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-(--radius-card) border bg-white px-4 py-3 text-left transition-colors hover:border-court-400 ${
                n.readAt ? "border-sand-200" : "border-l-4 border-sand-200 border-l-court-700"
              }`}
              onClick={() => markOne(n.id)}
              type="button"
            >
              <span className="font-semibold text-ink-900">{n.title}</span>
              <span className="text-[0.9rem] text-ink-700">{n.body}</span>
              <span className="text-sm text-ink-500">{formatWhen(n.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
