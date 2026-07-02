import { ChevronDown } from "lucide-react";

export const landingFaqItems = [
  {
    question: "How do booking holds work?",
    answer:
      "Creating a booking places a 5-minute hold on the slot. Pay the venue directly using the instructions shown at checkout, then submit your transaction reference and proof image before the hold expires. Once submitted, the slot stays reserved until the venue approves or rejects your proof — a submitted proof is never released automatically.",
  },
  {
    question: "How do refunds work?",
    answer:
      "You can request a refund-eligible cancellation at least 7 days before your session; the venue still confirms it. If the venue cancels on you, you are always refund-eligible. Refunds are settled directly between you and the venue, and both sides record the amount, channel, and reference.",
  },
  {
    question: "Is paying by screenshot safe?",
    answer:
      "A human reviews every proof — nothing is auto-approved, and duplicate references or suspicious details get flagged. No screenshot system is fraud-proof, which is exactly why CourtLink keeps people in the loop instead of pretending otherwise. Your proof images stay private and encrypted.",
  },
  {
    question: "Are coaches verified?",
    answer:
      "Coaches can publish immediately but carry a visible unverified status until the CourtLink team reviews them. Verified coaches display a badge. Ratings come only from players who completed sessions.",
  },
  {
    question: "How do I list my venue?",
    answer:
      "Create an account, set up your business, and add your venue with courts, operating hours, and prices. A platform admin reviews and approves it before it appears in search. Listing is free — you keep 100% of what players pay you.",
  },
  {
    question: "Can I install CourtLink as an app?",
    answer:
      "Yes — CourtLink is an installable progressive web app. On your phone, choose “Add to home screen” in your browser menu and it behaves like a native app, including offline support for key pages.",
  },
];

export function Faq() {
  return (
    <section aria-labelledby="faq" className="px-[5vw] py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-court-700">FAQ</span>
          <h2
            className="m-0 mt-2 font-display text-4xl font-bold tracking-tight text-ink-900"
            id="faq"
          >
            Fair questions, straight answers
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {landingFaqItems.map((item) => (
            <details
              className="group rounded-(--radius-card) border border-sand-200 bg-white open:border-court-400"
              key={item.question}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  aria-hidden="true"
                  className="shrink-0 text-ink-500 transition-transform group-open:rotate-180"
                  size={18}
                />
              </summary>
              <p className="m-0 px-5 pb-5 leading-relaxed text-ink-500">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
