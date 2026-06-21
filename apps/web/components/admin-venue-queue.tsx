"use client";

import { Check, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, type VenueSummary, apiFetch } from "../lib/api";

export function AdminVenueQueue({ venues }: { venues: VenueSummary[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(venue: VenueSummary, decision: "approve" | "reject") {
    setPendingId(venue.id);
    setError(null);
    try {
      await apiFetch(`/venues/admin/${venue.id}/${decision}`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setPendingId(null);
    }
  }

  if (venues.length === 0) {
    return <p className="empty-state">No venues are waiting for approval.</p>;
  }

  return (
    <div className="queue-list">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {venues.map((venue) => {
        const busy = pendingId === venue.id;
        return (
          <article className="queue-card" key={venue.id}>
            <div className="queue-head">
              <strong>{venue.name}</strong>
              <span className="status-pill status-pending_approval">Pending</span>
            </div>
            <p className="queue-when">
              <MapPin size={14} aria-hidden="true" /> {venue.streetAddress},{" "}
              {venue.cityMunicipality}
            </p>
            <div className="queue-actions">
              <button
                className="button button-small"
                type="button"
                disabled={busy}
                onClick={() => decide(venue, "approve")}
              >
                <Check size={16} aria-hidden="true" /> Approve
              </button>
              <button
                className="button button-secondary button-small"
                type="button"
                disabled={busy}
                onClick={() => decide(venue, "reject")}
              >
                <X size={16} aria-hidden="true" /> Reject
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
