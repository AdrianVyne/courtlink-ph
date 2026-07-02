"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "../lib/api";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[9px] border border-sand-200 bg-transparent font-semibold text-ink-700 hover:border-court-700 hover:text-court-800"
      type="button"
      onClick={handleLogout}
      disabled={pending}
      aria-label="Log out"
      title="Log out"
    >
      <LogOut size={18} aria-hidden="true" />
    </button>
  );
}
