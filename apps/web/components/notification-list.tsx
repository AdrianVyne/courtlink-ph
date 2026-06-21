"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, type NotificationItem } from "../lib/api";

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
    return <p className="empty-state">No notifications yet.</p>;
  }

  return (
    <div className="notif-wrap">
      <div className="notif-toolbar">
        <button
          className="button button-secondary button-small"
          type="button"
          onClick={markAll}
          disabled={pending}
        >
          Mark all read
        </button>
      </div>
      <ul className="notif-list">
        {items.map((n) => (
          <li className={`notif-row${n.readAt ? "" : " notif-unread"}`} key={n.id}>
            <button type="button" className="notif-item" onClick={() => markOne(n.id)}>
              <span className="notif-title">{n.title}</span>
              <span className="notif-body">{n.body}</span>
              <span className="notif-when">{formatWhen(n.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
