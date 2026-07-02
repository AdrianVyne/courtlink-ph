import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "../../components/content-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The rules of using CourtLink PH: accounts, booking holds, direct payments, proof review, refunds, reviews, and moderation — written plainly.",
};

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      lede="These terms describe how CourtLink PH actually works and what we expect from each other. They are written plainly and honestly — they are not legal advice, and reading them will not replace talking to a lawyer."
      title="Terms of service"
      updated="July 2, 2026"
    >
      <h2>What CourtLink is</h2>
      <p>
        CourtLink PH is a marketplace that connects players with pickleball venues and coaches in
        the Philippines. We list venues, publish schedules, hold booking slots, and track payment
        proof — but every booking is a direct arrangement between you and the venue or coach.
        CourtLink is not a party to that transaction and never holds your money.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide a real email address and keep your password to yourself.</li>
        <li>One person, one account. You are responsible for what happens under your login.</li>
        <li>
          Venue owners and coaches must have the authority to represent the business or services
          they list.
        </li>
      </ul>

      <h2>Bookings and payments</h2>
      <ul>
        <li>
          Creating a booking places a short hold on the slot. You pay the venue or coach directly —
          over GCash, Maya, QR Ph, or bank transfer — and submit your transaction reference and
          proof image before the hold expires.
        </li>
        <li>
          The venue or coach reviews your proof and confirms or rejects it. A submitted proof is
          never released automatically; a human decides.
        </li>
        <li>
          Submitting fake, altered, or reused payment proof is grounds for immediate account
          termination and may be reported to the payment provider.
        </li>
        <li>
          Refunds are settled directly between you and the venue or coach. Cancelling at least 7
          days before your session makes you refund-eligible; a venue cancellation always does. Both
          sides record the amount, channel, and reference so there is a shared paper trail.
        </li>
      </ul>

      <h2>Reviews</h2>
      <p>
        Only players who completed a booking can review it, within the review window. Reviews must
        be about the actual experience — no harassment, no doxxing, no review trading. Moderators
        can remove reviews that break these rules.
      </p>

      <h2>Listings and moderation</h2>
      <ul>
        <li>
          Venue listings are reviewed by a platform admin before appearing in search. Coaches can
          publish immediately but carry a visible unverified status until reviewed.
        </li>
        <li>
          Anyone can report a venue, coach, or review. Reports go to a moderation queue where an
          admin reviews the case and records a resolution.
        </li>
        <li>
          We can suspend or remove listings and accounts that break these terms, mislead players, or
          abuse other users. We aim to explain why whenever it is safe to do so.
        </li>
      </ul>

      <h2>The service itself</h2>
      <ul>
        <li>
          CourtLink is provided as-is. We work to keep it fast and available, but we do not
          guarantee uptime, and schedules ultimately belong to venues — a venue closing on you is
          between you and the venue, though it makes you refund-eligible.
        </li>
        <li>
          The platform is open source under the AGPL-3.0 license. You are free to read, run, and
          modify the code under that license's terms.
        </li>
        <li>
          We may update these terms as the product evolves. Meaningful changes will be visible on
          this page with an updated date.
        </li>
      </ul>

      <p>
        Questions about these terms? See the <Link href="/contact">contact page</Link>.
      </p>
    </ContentPage>
  );
}
