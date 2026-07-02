import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "../../components/content-page";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What data CourtLink PH collects, how payment proof images are protected, what venues can see, and how long things are kept.",
};

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      lede="This page describes what the platform actually collects and stores, in plain language. It is an honest description of system behavior, not legal advice."
      title="Privacy"
      updated="July 2, 2026"
    >
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your email, display name, and a hashed password — or your
          Google account identity if you sign in with Google. We never see your Google password.
        </li>
        <li>
          <strong>Booking data:</strong> the courts and coaches you book, times, quoted amounts, and
          booking statuses.
        </li>
        <li>
          <strong>Payment proof:</strong> the transaction reference and proof image you submit for a
          booking. CourtLink never sees or stores your GCash, Maya, or bank credentials — payments
          happen entirely outside the platform.
        </li>
        <li>
          <strong>Content you write:</strong> reviews, coach request details, and reports.
        </li>
        <li>
          <strong>Session cookie:</strong> a single cookie keeps you logged in. There are no
          third-party trackers, no analytics scripts, and no ad networks on this site.
        </li>
      </ul>

      <h2>How payment proofs are protected</h2>
      <p>
        Proof images are re-encoded on upload (stripping metadata and anything that is not a plain
        image), stored in private object storage, and encrypted at rest. They are visible only to
        the venue or coach reviewing your booking and to platform admins handling a dispute — never
        public, never used for anything else.
      </p>

      <h2>Who sees what</h2>
      <ul>
        <li>
          Venues and coaches see the booking details they need: your display name, the slot, the
          amount, and your payment proof for their own bookings.
        </li>
        <li>Other players see only your display name on reviews you write.</li>
        <li>
          Platform admins can access account and booking records when moderating reports or
          disputes.
        </li>
        <li>We do not sell or share your data with third parties.</li>
      </ul>

      <h2>Retention</h2>
      <p>
        Booking and proof records are kept while your account is active, because they are the shared
        paper trail both sides rely on for disputes and refunds. Notifications are pruned over time.
        If you want your account and its data removed, ask via the{" "}
        <Link href="/contact">contact page</Link> — records a venue still legitimately needs for an
        unresolved dispute may be retained until it is resolved.
      </p>

      <h2>Where it runs</h2>
      <p>
        CourtLink PH is open source (AGPL-3.0), so how all of this works is publicly verifiable in
        the code — including the encryption, proof handling, and moderation flows described here.
        Meaningful changes to this page will be visible with an updated date.
      </p>
    </ContentPage>
  );
}
