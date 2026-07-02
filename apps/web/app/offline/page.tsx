import { Button, CourtLines } from "../../components/ui";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-[5vw] py-24 text-center">
      <CourtLines className="w-64 text-court-200" variant="field" />
      <span className="text-xs font-bold uppercase tracking-widest text-court-700">
        Connection unavailable
      </span>
      <h1 className="m-0 font-display text-5xl font-bold tracking-tight text-ink-900">
        You are offline
      </h1>
      <p className="m-0 max-w-md text-ink-500">
        Reconnect to view live court availability, bookings, and payment updates.
      </p>
      <Button href="/">Try again</Button>
    </main>
  );
}
