"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const primaryNav = [
  { href: "/courts", label: "Courts" },
  { href: "/coaches", label: "Coaches" },
  { href: "/coach-requests", label: "Coaching" },
] as const;

export function NavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary navigation" className={className}>
      {primaryNav.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`relative py-1 text-sm font-semibold text-ink-700 transition-colors hover:text-court-800 ${
              active
                ? "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-lime-500"
                : ""
            }`}
            href={href}
            key={href}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
