import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "../../components/content-page";

export const metadata: Metadata = {
  title: "About",
  description:
    "CourtLink PH is an open-source marketplace for booking pickleball courts and coaches across the Philippines — you always pay venues and coaches directly.",
};

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      lede="CourtLink PH connects Filipino pickleball players with courts and coaches — without standing between you and your money."
      title="Built for Filipino pickleball"
    >
      <h2>What CourtLink does</h2>
      <p>
        Finding a court in the Philippines usually means group chats, spreadsheets, and hoping
        someone answers. CourtLink puts real venues with real schedules in one place: search by
        city, hold a slot, pay the venue directly over GCash, Maya, QR Ph, or bank transfer, and
        submit your payment proof. A person at the venue confirms it — then you play.
      </p>
      <p>
        Coaches work the same way. Browse verified coaches, book their published availability, or
        post an open request and let coaches come to you with offers.
      </p>

      <h2>Direct payments, on purpose</h2>
      <p>
        CourtLink never holds your money. Players pay venues and coaches directly using the payment
        channels they already trust, and the platform tracks the hold, the proof, and the
        confirmation. Venues keep 100% of what players pay them. Payment proof images stay private,
        are encrypted at rest, and are only visible to the people who need to review them.
      </p>

      <h2>How the platform sustains itself</h2>
      <p>
        Listing a venue and booking as a player are free. The project is run lean — no commissions
        on payments, no ads, no selling your data. If sustaining costs ever require paid features,
        they will be clearly labeled and optional; the core marketplace stays free.
      </p>

      <h2>Open source</h2>
      <p>
        CourtLink PH is open source under the AGPL-3.0 license. The full code — booking holds, proof
        review, moderation, everything described on this site — is public. You can read it, report
        issues, or contribute at{" "}
        <a href="https://github.com/AdrianVyne/courtlink-ph" rel="noreferrer" target="_blank">
          github.com/AdrianVyne/courtlink-ph
        </a>
        .
      </p>

      <h2>Get in touch</h2>
      <p>
        Questions and feedback are welcome — see the <Link href="/contact">contact page</Link> for
        the best channel, or check the <Link href="/faq">FAQ</Link> first.
      </p>
    </ContentPage>
  );
}
