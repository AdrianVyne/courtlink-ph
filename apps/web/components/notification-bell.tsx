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
      className="relative inline-flex size-10 items-center justify-center rounded-[9px] border border-sand-200 hover:border-court-700 hover:text-court-800"
      href="/notifications"
      aria-label="Notifications"
      title="Notifications"
    >
      <Bell size={18} aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#c0362c] px-[0.25rem] py-[0.15rem] text-center text-[0.65rem] font-bold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
