import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "../../components/content-page";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to reach CourtLink PH — report a problem with a venue or coach, ask a question, or report a bug.",
};

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Contact"
      lede="Most questions are answered fastest in the right channel — here is where each one goes."
      title="Get in touch"
    >
      <h2>Report a venue, coach, or review</h2>
      <p>
        If something on the platform looks wrong — a misleading listing, an abusive review, a
        no-show coach — use the <strong>Report</strong> button on that venue or coach page while
        logged in. Reports go straight to the moderation queue, where a platform admin reviews every
        case and records a resolution. This is the fastest path for anything safety-related.
      </p>

      <h2>Booking problems</h2>
      <p>
        Payment and booking disputes are settled directly between you and the venue or coach,
        because payments never pass through CourtLink. Start from your{" "}
        <Link href="/dashboard">dashboard</Link>: every booking shows its status, proof, and refund
        trail. The <Link href="/faq">FAQ</Link> explains holds, proof review, and refund windows.
      </p>

      <h2>Bugs, questions, and feedback</h2>
      <p>
        CourtLink PH is open source. Bug reports and feature requests are tracked publicly on{" "}
        <a
          href="https://github.com/AdrianVyne/courtlink-ph/issues"
          rel="noreferrer"
          target="_blank"
        >
          GitHub issues
        </a>
        . Security vulnerabilities should be reported privately via{" "}
        <a
          href="https://github.com/AdrianVyne/courtlink-ph/security"
          rel="noreferrer"
          target="_blank"
        >
          GitHub private vulnerability reporting
        </a>{" "}
        — please do not open a public issue for those.
      </p>

      <h2>Listing your venue</h2>
      <p>
        No need to contact anyone — <Link href="/register">create an account</Link>, set up your
        business, and add your venue. An admin reviews every listing before it appears in search.
      </p>
    </ContentPage>
  );
}
