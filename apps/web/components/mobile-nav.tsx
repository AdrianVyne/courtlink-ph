"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionUser } from "../lib/api";
import { LogoutButton } from "./logout-button";
import { primaryNav } from "./nav-links";

export function MobileNav({ session }: { session: SessionUser | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const openDrawer = useCallback(() => {
    dialogRef.current?.showModal();
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <div className="md:hidden">
      <button
        aria-controls="mobile-nav"
        aria-expanded={open}
        className="inline-flex size-10 items-center justify-center rounded-(--radius-control) border border-sand-200 text-ink-700 hover:border-court-700 hover:text-court-800"
        onClick={openDrawer}
        type="button"
      >
        <Menu aria-hidden="true" size={20} />
        <span className="sr-only">Open menu</span>
      </button>
      <dialog
        aria-label="Site menu"
        className="m-0 ml-auto h-full max-h-none w-72 max-w-[85vw] bg-white p-0 backdrop:bg-court-950/40"
        id="mobile-nav"
        ref={dialogRef}
      >
        <div className="flex h-full flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-court-800">Menu</span>
            <button
              className="inline-flex size-10 items-center justify-center rounded-(--radius-control) border border-sand-200 text-ink-700 hover:border-court-700"
              onClick={closeDrawer}
              type="button"
            >
              <X aria-hidden="true" size={20} />
              <span className="sr-only">Close menu</span>
            </button>
          </div>
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {primaryNav.map(({ href, label }) => (
              <Link
                className="rounded-(--radius-control) px-3 py-3 text-base font-semibold text-ink-900 hover:bg-court-50"
                href={href}
                key={href}
                onClick={closeDrawer}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 border-t border-sand-200 pt-4">
            {session ? (
              <>
                <Link
                  className="rounded-(--radius-control) px-3 py-3 font-semibold text-ink-900 hover:bg-court-50"
                  href="/dashboard"
                  onClick={closeDrawer}
                >
                  {session.displayName}
                </Link>
                <Link
                  className="rounded-(--radius-control) px-3 py-3 font-semibold text-ink-900 hover:bg-court-50"
                  href="/notifications"
                  onClick={closeDrawer}
                >
                  Notifications
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  className="rounded-(--radius-control) px-3 py-3 font-semibold text-ink-900 hover:bg-court-50"
                  href="/login"
                  onClick={closeDrawer}
                >
                  Log in
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-(--radius-control) bg-court-700 px-5 font-semibold text-white hover:bg-court-800"
                  href="/register"
                  onClick={closeDrawer}
                >
                  Join CourtLink
                </Link>
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
