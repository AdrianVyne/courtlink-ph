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
      className="text-button icon-button"
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
