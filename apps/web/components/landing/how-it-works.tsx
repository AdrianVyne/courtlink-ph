"use client";

import { type KeyboardEvent, useRef, useState } from "react";

interface Step {
  title: string;
  detail: string;
}

const tabs: Array<{ id: string; label: string; steps: Step[] }> = [
  {
    id: "players",
    label: "For players",
    steps: [
      {
        title: "Find your court or coach",
        detail:
          "Search by city, date, price, and amenities across the Philippines — or post an open coaching request and compare offers.",
      },
      {
        title: "Hold your slot, pay direct",
        detail:
          "Booking places a 5-minute hold. Pay the venue or coach directly over GCash, Maya, QR Ph, or bank transfer, then upload your proof of payment.",
      },
      {
        title: "Get confirmed and play",
        detail:
          "The venue or coach reviews your proof and confirms. After the session, only real participants can leave a rating.",
      },
    ],
  },
  {
    id: "owners",
    label: "For venues & coaches",
    steps: [
      {
        title: "List your courts or profile",
        detail:
          "Create your venue with courts, schedules, and prices — or publish a coach profile with your rates and availability.",
      },
      {
        title: "Get discovered nationwide",
        detail:
          "Approved venues appear in search for every player in your city. Coaches can also bid on open requests with priced offers.",
      },
      {
        title: "Confirm bookings, keep every peso",
        detail:
          "Review payment proofs in your workspace and confirm. Players pay you directly — CourtLink takes no commission.",
      },
    ],
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = {
      ArrowRight: (active + 1) % tabs.length,
      ArrowLeft: (active - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section aria-labelledby="how-it-works" className="bg-white px-[5vw] py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-court-700">
            How it works
          </span>
          <h2
            className="m-0 mt-2 font-display text-4xl font-bold tracking-tight text-ink-900"
            id="how-it-works"
          >
            From search to serve in three steps
          </h2>
        </div>

        <div
          aria-label="How CourtLink works"
          className="mx-auto mb-8 flex w-fit rounded-full border border-sand-200 bg-sand-100 p-1"
          onKeyDown={onKeyDown}
          role="tablist"
        >
          {tabs.map((tab, index) => (
            <button
              aria-controls={`panel-${tab.id}`}
              aria-selected={active === index}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                active === index
                  ? "bg-court-700 text-white dark:bg-lime-400 dark:text-court-950"
                  : "text-ink-700 hover:text-court-800"
              }`}
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActive(index)}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              tabIndex={active === index ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {tabs.map((tab, index) => (
          <div
            aria-labelledby={`tab-${tab.id}`}
            className={active === index ? "grid gap-4 md:grid-cols-3" : "hidden"}
            id={`panel-${tab.id}`}
            key={tab.id}
            role="tabpanel"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: APG tabs pattern — a tabpanel without focusable children should itself be focusable.
            tabIndex={0}
          >
            {tab.steps.map((step, stepIndex) => (
              <article
                className="rounded-(--radius-card) border border-sand-200 bg-sand-50 p-6"
                key={step.title}
              >
                <span className="tnum font-display text-sm font-bold text-court-700">
                  Step {stepIndex + 1}
                </span>
                <h3 className="m-0 mt-2 mb-2 text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="m-0 text-[0.92rem] leading-relaxed text-ink-500">{step.detail}</p>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
