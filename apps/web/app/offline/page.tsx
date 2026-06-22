import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="page-shell">
      <section className="empty-state">
        <p className="eyebrow">Connection unavailable</p>
        <h1>You are offline</h1>
        <p>Reconnect to view live court availability, bookings, and payment updates.</p>
        <Link className="button button-primary" href="/">
          Try again
        </Link>
      </section>
    </main>
  );
}
