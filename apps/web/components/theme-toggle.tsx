"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "courtlink-theme";

export type ThemePreference = "system" | "light" | "dark";

const CYCLE: ThemePreference[] = ["system", "light", "dark"];

const ICONS: Record<ThemePreference, ReturnType<typeof SunIcon>> = {
  system: <SystemIcon />,
  light: <SunIcon />,
  dark: <MoonIcon />,
};

function isPreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolveTheme(preference);
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isPreference(stored)) setPreference(stored);
  }, []);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const next = CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length] as ThemePreference;

  return (
    <button
      aria-label={`Theme: ${preference}. Switch to ${next}.`}
      className="inline-flex size-10 items-center justify-center rounded-(--radius-control) border border-sand-200 text-ink-700 transition-colors hover:bg-court-50 hover:text-court-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700 dark:focus-visible:outline-lime-400"
      onClick={() => {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
        setPreference(next);
      }}
      title={`Theme: ${preference}. Switch to ${next}.`}
      type="button"
    >
      {ICONS[preference]}
    </button>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="2" width="18" x="3" y="4" />
      <path d="M9 20h6M12 16.5V20" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
