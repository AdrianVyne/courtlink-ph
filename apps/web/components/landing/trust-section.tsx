import { Lock, ShieldCheck, Star } from "lucide-react";

const pillars = [
  {
    icon: ShieldCheck,
    title: "You pay direct — we never hold your money",
    detail:
      "Checkout shows the venue's or coach's own GCash, Maya, QR Ph, or bank details. Your payment goes straight to them, with no platform markup or commission.",
  },
  {
    icon: Lock,
    title: "Payment proofs stay private",
    detail:
      "Proof images are encrypted at rest, re-encoded for safety, and visible only to you, the party reviewing your booking, and platform moderators — through short-lived links, never public URLs.",
  },
  {
    icon: Star,
    title: "Reviews from real bookings only",
    detail:
      "Only people who actually completed a booking can rate a venue or coach. A human reviews every payment proof — flagged duplicates and mismatches are never auto-approved.",
  },
];

export function TrustSection() {
  return (
    <section aria-labelledby="trust" className="bg-white px-[5vw] py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-court-700">
            Built on trust
          </span>
          <h2
            className="m-0 mt-2 font-display text-4xl font-bold tracking-tight text-ink-900"
            id="trust"
          >
            Your money moves the way it should
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, detail }) => (
            <article className="rounded-(--radius-card) border border-sand-200 p-6" key={title}>
              <span className="inline-flex size-11 items-center justify-center rounded-(--radius-control) bg-court-100 text-court-700">
                <Icon aria-hidden="true" size={22} />
              </span>
              <h3 className="m-0 mt-4 mb-2 text-lg font-semibold text-ink-900">{title}</h3>
              <p className="m-0 text-[0.92rem] leading-relaxed text-ink-500">{detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
