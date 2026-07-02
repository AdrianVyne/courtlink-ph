import Link from "next/link";
import { CourtLines } from "./ui";

const columns = [
  {
    heading: "Product",
    links: [
      { href: "/courts", label: "Find a court" },
      { href: "/coaches", label: "Find a coach" },
      { href: "/coach-requests", label: "Coaching requests" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

const paymentMethods = ["GCash", "Maya", "QR Ph", "Bank transfer"];

export function SiteFooter() {
  return (
    <footer className="bg-court-950 text-sand-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-[5vw] py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 font-display text-lg font-bold">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-lime-400 text-xs font-extrabold tracking-tight text-court-950">
              CL
            </span>
            CourtLink PH
          </div>
          <p className="m-0 max-w-xs text-sm leading-relaxed text-sand-100/70">
            Built for Filipino pickleball. Book courts and coaches nationwide — you always pay
            venues and coaches directly.
          </p>
          <CourtLines className="mt-1 w-56 text-lime-400/25" variant="field" />
        </div>
        {columns.map((column) => (
          <nav aria-label={column.heading} className="flex flex-col gap-3" key={column.heading}>
            <span className="text-xs font-bold uppercase tracking-widest text-lime-400">
              {column.heading}
            </span>
            {column.links.map((link) => (
              <Link
                className="w-fit text-sm text-sand-100/85 transition-colors hover:text-white"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-[5vw] py-5">
          <p className="m-0 text-xs text-sand-100/60">
            © {new Date().getFullYear()} CourtLink PH. Open source under AGPL-3.0.
          </p>
          <ul
            className="m-0 flex list-none flex-wrap gap-2 p-0"
            aria-label="Supported payment channels"
          >
            {paymentMethods.map((method) => (
              <li
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-sand-100/80"
                key={method}
              >
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
