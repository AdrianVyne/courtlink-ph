import { describe, expect, it } from "vitest";
import { REVIEW_ESCALATION_QUEUE, buildEscalationNotifications } from "./review-escalation.js";

describe("buildEscalationNotifications", () => {
  it("creates one court notification per unique recipient", () => {
    const drafts = buildEscalationNotifications({
      scope: "court",
      bookingId: "b1",
      recipientUserIds: ["owner", "owner", "admin", ""],
    });
    expect(drafts).toHaveLength(2);
    expect(drafts.every((d) => d.type === "COURT_REVIEW_OVERDUE")).toBe(true);
    expect(drafts[0]?.data).toEqual({ bookingId: "b1", scope: "court" });
  });

  it("uses a coach-specific type for coaching escalations", () => {
    const drafts = buildEscalationNotifications({
      scope: "coach",
      bookingId: "c1",
      recipientUserIds: ["coach"],
    });
    expect(drafts[0]?.type).toBe("COACH_REVIEW_OVERDUE");
  });

  it("uses a namespaced queue name", () => {
    expect(REVIEW_ESCALATION_QUEUE).toBe("court.reviews.escalation");
  });
});
