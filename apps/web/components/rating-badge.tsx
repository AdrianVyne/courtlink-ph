import { Star } from "lucide-react";

export function RatingBadge({ average, count }: { average: number; count: number }) {
  if (count === 0) {
    return <span className="text-[0.85rem] text-ink-500">No reviews yet</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-[0.3rem] font-bold text-pending-fg"
      role="img"
      aria-label={`${average} out of 5 from ${count} reviews`}
    >
      <Star size={15} aria-hidden="true" />
      {average.toFixed(1)} <span className="font-semibold text-ink-500">({count})</span>
    </span>
  );
}
