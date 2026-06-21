import { ArrowRight, CalendarDays, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "../components/site-header";
import { getSession } from "../lib/session";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: MapPin,
    title: "Courts across the Philippines",
    detail: "Browse trusted venues by city, schedule, price, and amenities.",
  },
  {
    icon: CalendarDays,
    title: "Clear availability",
    detail: "Choose a time that works and keep every booking in one place.",
  },
  {
    icon: Users,
    title: "Coaches for every level",
    detail: "Book a coach directly or post a request and compare offers.",
  },
];

export default async function HomePage() {
  const session = await getSession();

  return (
    <main>
      <SiteHeader session={session} />

      <section className="hero">
        <div className="eyebrow">
          <ShieldCheck size={16} aria-hidden="true" />
          Pickleball, made easier
        </div>
        <h1>Book your next pickleball game.</h1>
        <p className="hero-copy">
          Discover courts, connect with coaches, and organize your next session anywhere in the
          Philippines.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/courts">
            Find a court <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className="button button-secondary" href="/coaches">
            Find a coach
          </Link>
        </div>
        <section className="availability-card" aria-label="Court search preview">
          <div>
            <span className="field-label">Location</span>
            <strong>Metro Manila</strong>
          </div>
          <div>
            <span className="field-label">Date</span>
            <strong>This weekend</strong>
          </div>
          <div>
            <span className="field-label">Players</span>
            <strong>4 players</strong>
          </div>
          <Link className="button button-small" href="/courts">
            Search availability
          </Link>
        </section>
      </section>

      <section className="features" aria-labelledby="why-courtlink">
        <div className="section-heading">
          <span className="kicker">Everything in one place</span>
          <h2 id="why-courtlink">Spend less time planning. Play more.</h2>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, detail }) => (
            <article className="feature-card" key={title}>
              <span className="feature-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
