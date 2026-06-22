import { Star } from "lucide-react";

export function RatingBadge({ average, count }: { average: number; count: number }) {
  if (count === 0) {
    return <span className="rating-empty">No reviews yet</span>;
  }
  return (
    <span
      className="rating-badge"
      role="img"
      aria-label={`${average} out of 5 from ${count} reviews`}
    >
      <Star size={15} aria-hidden="true" />
      {average.toFixed(1)} <span className="rating-count">({count})</span>
    </span>
  );
}
