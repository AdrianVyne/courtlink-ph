/**
 * Signature motif: pickleball court geometry (sidelines, kitchen lines,
 * service centerlines, net) drawn to scale (44ft x 20ft, 7ft kitchen).
 */
export function CourtLines({
  className = "",
  variant = "field",
}: {
  className?: string;
  variant?: "field" | "corner" | "divider";
}) {
  if (variant === "corner") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 120 120"
      >
        <path d="M4 116V4h112" />
        <path d="M4 60h70" />
        <path d="M74 4v112" />
      </svg>
    );
  }

  if (variant === "divider") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        preserveAspectRatio="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 440 24"
      >
        <path d="M0 12h150" />
        <path d="M170 2v20M270 2v20" strokeWidth="1" />
        <path d="M220 0v24" strokeDasharray="3 4" />
        <path d="M290 12h150" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 440 200"
    >
      {/* boundary */}
      <rect height="192" rx="2" width="432" x="4" y="4" />
      {/* net */}
      <path d="M220 0v200" strokeDasharray="4 5" />
      {/* kitchen (non-volley) lines, 7ft from net */}
      <path d="M150 4v192M290 4v192" />
      {/* service centerlines from kitchen to baseline */}
      <path d="M4 100h146M290 100h146" />
    </svg>
  );
}
