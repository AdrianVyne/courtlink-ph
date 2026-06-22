"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "../lib/api";

export function FavoriteToggle({ venueId, initial }: { venueId: string; initial: boolean }) {
  const [favorite, setFavorite] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      if (favorite) {
        await apiFetch(`/favorites/venues/${venueId}`, { method: "DELETE" });
        setFavorite(false);
      } else {
        await apiFetch("/favorites", { method: "POST", body: { venueId } });
        setFavorite(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className={`favorite-toggle${favorite ? " is-favorite" : ""}`}
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      title={favorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart size={16} aria-hidden="true" />
      {favorite ? "Saved" : "Save"}
    </button>
  );
}
