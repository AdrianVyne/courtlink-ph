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
    <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
      {promotions.map((promotion) => (
        <li
          className="flex flex-wrap items-center gap-[0.6rem] rounded-[10px] border border-[#f1d9a0] bg-[#fff8e6] px-[0.85rem] py-[0.6rem]"
          key={promotion.id}
        >
          <span className="inline-flex items-center gap-[0.3rem] rounded-full bg-pending-fg px-[0.6rem] py-[0.2rem] text-[0.74rem] font-bold text-white">
            <Tag size={14} aria-hidden="true" /> {discountLabel(promotion)}
          </span>
          <span className="font-bold">{promotion.title}</span>
          {promotion.description ? (
            <span className="text-[0.88rem] text-[#6a5a30]">{promotion.description}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
