"use client";

import { Button } from "../components/ui";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-5 px-[5vw] py-24 text-center">
      <h1 className="m-0 font-display text-4xl font-bold tracking-tight text-ink-900">
        Something went wrong
      </h1>
      <p className="m-0 max-w-md text-ink-500">
        The page could not load. Your bookings and account are unaffected — try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
