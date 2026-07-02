"use client";

import { Check, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, type VenueSummary, apiFetch } from "../lib/api";
import { Button, Card, EmptyState, StatusPill, useToast } from "./ui";

export function AdminVenueQueue({ venues }: { venues: VenueSummary[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function decide(venue: VenueSummary, decision: "approve" | "reject") {
    setPendingId(venue.id);
    try {
      await apiFetch(`/venues/admin/${venue.id}/${decision}`, { method: "POST" });
      push(decision === "approve" ? "Venue approved." : "Venue rejected.");
      router.refresh();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Action failed.", "danger");
    } finally {
      setPendingId(null);
    }
  }

  if (venues.length === 0) {
    return (
      <EmptyState
        body="New venue submissions land here for review."
        title="No venues are waiting for approval"
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {venues.map((venue) => {
        const busy = pendingId === venue.id;
        return (
          <Card className="flex flex-col gap-2 p-5" key={venue.id}>
            <div className="flex items-center justify-between gap-3">
              <strong className="text-ink-900">{venue.name}</strong>
              <StatusPill status="PENDING_APPROVAL" />
            </div>
            <p className="m-0 flex items-center gap-1 text-sm text-ink-700">
              <MapPin aria-hidden="true" size={14} /> {venue.streetAddress},{" "}
              {venue.cityMunicipality}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button loading={busy} onClick={() => decide(venue, "approve")} size="sm">
                <Check aria-hidden="true" size={16} /> Approve
              </Button>
              <Button
                disabled={busy}
                onClick={() => decide(venue, "reject")}
                size="sm"
                variant="secondary"
              >
                <X aria-hidden="true" size={16} /> Reject
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
