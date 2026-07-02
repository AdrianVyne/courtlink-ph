"use client";

import { useEffect, useState } from "react";

/** Live mm:ss until the given instant; clamps at 0:00. */
export function Countdown({ until, className = "" }: { until: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = Math.max(0, new Date(until).getTime() - now);
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return (
    <span aria-live="off" className={`tnum ${className}`.trim()} suppressHydrationWarning>
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
