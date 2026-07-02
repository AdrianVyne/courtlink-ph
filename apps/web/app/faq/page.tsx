import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { ContentPage } from "../../components/content-page";
import { landingFaqItems } from "../../components/landing/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about booking holds, direct payments, proof review, refunds, coach verification, and listing a venue on CourtLink PH.",
};

const extraItems = [
  {
    question: "What happens if my proof is rejected?",
    answer:
      "The venue records a reason, your booking is released, and you are notified. If you already paid, settle it directly with the venue using your payment reference — rejection usually means a typo in the reference or an unreadable screenshot, and you can book again right away.",
  },
  {
    question: "Can a venue cancel my confirmed booking?",
    answer:
      "Yes, venues can cancel — for example for maintenance or double-booked courts — but a venue cancellation always makes you refund-eligible, and both sides record how the refund was settled.",
  },
  {
    question: "How do coach open requests work?",
    answer:
      "Post what you want — date, location, group size, skill level — and coaches send offers with a price and message. Offers expire automatically. Accepting one creates the booking and declines the rest atomically, so you can never accidentally book two coaches.",
  },
  {
    question: "Who can see my payment proof?",
    answer:
      "Only the people who need to review it: the venue or coach confirming your booking, and platform admins handling a dispute. Proof images are stored privately and encrypted at rest — they are never public and never used for anything else.",
  },
  {
    question: "Who can leave a review?",
    answer:
      "Only players with a completed booking at that venue or with that coach, within the review window. There is no way to buy, import, or self-post ratings.",
  },
  {
    question: "Is CourtLink really free?",
    answer:
      "Booking is free for players, and listing is free for venues and coaches — they keep 100% of what you pay them. The platform is open source under AGPL-3.0, so all of this is verifiable in the code.",
  },
];

const items = [...landingFaqItems, ...extraItems];

export default function FaqPage() {
  return (
    <ContentPage
      eyebrow="FAQ"
      lede="Everything about holds, direct payments, proof review, refunds, and verification — answered plainly."
      title="Fair questions, straight answers"
    >
      <div className="flex flex-col gap-3">
        {items.map((item) => (
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
    </ContentPage>
  );
}
