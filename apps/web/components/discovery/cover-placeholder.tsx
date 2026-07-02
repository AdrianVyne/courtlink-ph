import { CourtLines } from "../ui";

const treatments = [
  { surface: "bg-court-100", lines: "text-court-400/60" },
  { surface: "bg-lime-300/40", lines: "text-court-600/50" },
  { surface: "bg-sand-200", lines: "text-court-400/50" },
  { surface: "bg-court-200", lines: "text-court-700/40" },
] as const;

function hash(input: string): number {
  let value = 0;
  for (const char of input) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** Deterministic tokened cover art for venues without photos yet. */
export function CoverPlaceholder({ seed, className = "" }: { seed: string; className?: string }) {
  const treatment = treatments[hash(seed) % treatments.length] ?? treatments[0];
  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center justify-center overflow-hidden ${treatment.surface} ${className}`.trim()}
    >
      <CourtLines
        className={`absolute inset-x-4 top-1/2 w-[calc(100%-2rem)] -translate-y-1/2 ${treatment.lines}`}
        variant="field"
      />
    </div>
  );
}
