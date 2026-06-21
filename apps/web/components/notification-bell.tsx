"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await apiFetch<{ count: number }>("/notifications/unread-count");
        if (active) setCount(result.count);
      } catch {
        // Ignore; the bell simply shows no badge if the count is unavailable.
      }
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <Link
      className="notif-bell"
      href="/notifications"
      aria-label="Notifications"
      title="Notifications"
    >
      <Bell size={18} aria-hidden="true" />
      {count > 0 ? <span className="notif-badge">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
