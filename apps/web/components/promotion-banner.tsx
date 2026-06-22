import { Tag } from "lucide-react";
import type { Promotion } from "../lib/api";

function discountLabel(promotion: Promotion): string {
  return promotion.discountType === "PERCENT"
    ? `${promotion.discountValue}% off`
    : `PHP ${promotion.discountValue.toFixed(2)} off`;
}

export function PromotionBanner({ promotions }: { promotions: Promotion[] }) {
  if (promotions.length === 0) return null;
  return (
    <ul className="promo-list">
      {promotions.map((promotion) => (
        <li className="promo-item" key={promotion.id}>
          <span className="promo-tag">
            <Tag size={14} aria-hidden="true" /> {discountLabel(promotion)}
          </span>
          <span className="promo-title">{promotion.title}</span>
          {promotion.description ? (
            <span className="promo-desc">{promotion.description}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
