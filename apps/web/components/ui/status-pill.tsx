const tones = {
  success: "bg-success-bg text-success-fg",
  pending: "bg-pending-bg text-pending-fg",
  danger: "bg-danger-bg text-danger-fg",
  neutral: "bg-sand-100 text-ink-700",
} as const;

type Tone = keyof typeof tones;

const toneByStatus: Record<string, Tone> = {
  confirmed: "success",
  completed: "success",
  approved: "success",
  held: "pending",
  proof_submitted: "pending",
  pending_approval: "pending",
  pending_coach: "pending",
  refund_requested: "pending",
  rejected: "danger",
  cancelled: "danger",
  declined: "danger",
  expired: "danger",
};

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    toneByStatus[normalized] ?? (normalized.startsWith("pending") ? "pending" : "neutral");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${tones[tone]}`}
      data-tone={tone}
    >
      {normalized.replace(/_/g, " ")}
    </span>
  );
}
