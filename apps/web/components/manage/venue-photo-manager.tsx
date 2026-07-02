"use client";

import { ArrowDown, ArrowUp, ImagePlus, Save, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, type VenuePhotoInfo } from "../../lib/api";
import { Button, Field, Input } from "../ui";

export type ManagedVenuePhoto = VenuePhotoInfo & { createdAt?: string };

async function readPhotoResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as { code?: string; message?: string | string[] }) : {};
  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : (body.message ?? `Request failed with ${response.status}`);
    throw new ApiError(response.status, body.code ?? "API_ERROR", message);
  }
  if (response.status === 204) return undefined as T;
  return body as T;
}

function photoUrl(venueId: string, photoId?: string): string {
  return photoId
    ? `/api/v1/venues/${venueId}/photos/${photoId}`
    : `/api/v1/venues/${venueId}/photos`;
}

function sortPhotos(photos: ManagedVenuePhoto[]): ManagedVenuePhoto[] {
  return [...photos].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function draftsFrom(photos: ManagedVenuePhoto[]): Record<string, string> {
  return Object.fromEntries(photos.map((photo) => [photo.id, photo.altText]));
}

function idempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

async function photoRequest<T>(path: string, init: RequestInit): Promise<T> {
  return readPhotoResponse<T>(
    await fetch(path, {
      credentials: "include",
      ...init,
    }),
  );
}

export function VenuePhotoManager({
  venueId,
  photos: initialPhotos,
}: {
  venueId: string;
  photos: ManagedVenuePhoto[];
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(() => sortPhotos(initialPhotos));
  const [drafts, setDrafts] = useState<Record<string, string>>(() => draftsFrom(initialPhotos));
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoAltText, setNewPhotoAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ordered = useMemo(() => sortPhotos(photos), [photos]);
  const canUpload = ordered.length < 8;

  useEffect(() => {
    setPhotos(sortPhotos(initialPhotos));
    setDrafts(draftsFrom(initialPhotos));
  }, [initialPhotos]);

  async function upload(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const form = event?.currentTarget;
    if (!newPhotoFile || newPhotoFile.size === 0) {
      setError("Choose a photo file.");
      return;
    }
    const altText = newPhotoAltText.trim();
    if (altText.length < 5) {
      setError("Describe the photo in 5-200 characters.");
      return;
    }

    const formData = new FormData();
    formData.append("file", newPhotoFile);
    formData.append("altText", altText);

    setBusy("upload");
    setError(null);
    try {
      const photo = await photoRequest<ManagedVenuePhoto>(photoUrl(venueId), {
        body: formData,
        headers: { "Idempotency-Key": idempotencyKey() },
        method: "POST",
      });
      setPhotos((current) => sortPhotos([...current, photo]));
      setDrafts((current) => ({ ...current, [photo.id]: photo.altText }));
      setNewPhotoFile(null);
      setNewPhotoAltText("");
      form?.reset();
      router.refresh();
    } catch (error) {
      setError(errorMessage(error, "Photo upload failed."));
    } finally {
      setBusy(null);
    }
  }

  async function move(photo: ManagedVenuePhoto, target: ManagedVenuePhoto) {
    setBusy(photo.id);
    setError(null);
    try {
      const updated = await photoRequest<ManagedVenuePhoto>(photoUrl(venueId, photo.id), {
        body: JSON.stringify({ position: target.position }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setPhotos((current) =>
        sortPhotos(
          current.map((entry) => {
            if (entry.id === updated.id) return { ...entry, ...updated };
            if (entry.id === target.id) return { ...entry, position: photo.position };
            return entry;
          }),
        ),
      );
      router.refresh();
    } catch (error) {
      setError(errorMessage(error, "Photo order update failed."));
    } finally {
      setBusy(null);
    }
  }

  async function saveAlt(photo: ManagedVenuePhoto) {
    setBusy(photo.id);
    setError(null);
    try {
      const altText = (drafts[photo.id] ?? photo.altText).trim();
      const updated = await photoRequest<ManagedVenuePhoto>(photoUrl(venueId, photo.id), {
        body: JSON.stringify({ altText }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setPhotos((current) =>
        sortPhotos(
          current.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
        ),
      );
      setDrafts((current) => ({ ...current, [updated.id]: updated.altText }));
      router.refresh();
    } catch (error) {
      setError(errorMessage(error, "Alt text update failed."));
    } finally {
      setBusy(null);
    }
  }

  async function remove(photo: ManagedVenuePhoto) {
    setBusy(photo.id);
    setError(null);
    try {
      await photoRequest<void>(photoUrl(venueId, photo.id), { method: "DELETE" });
      setPhotos((current) => sortPhotos(current.filter((entry) => entry.id !== photo.id)));
      router.refresh();
    } catch (error) {
      setError(errorMessage(error, "Photo delete failed."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby={`venue-photos-${venueId}`} className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h3 className="m-0 text-base font-semibold text-ink-900" id={`venue-photos-${venueId}`}>
          Venue photos
        </h3>
        <span className="text-sm font-semibold text-ink-500">{ordered.length}/8 photos</span>
      </div>

      {error ? (
        <p
          className="mb-3 mt-0 rounded-[10px] border border-[#f1b5b0] bg-danger-bg px-[0.8rem] py-[0.6rem] text-[0.88rem] text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form className="rounded-[12px] border border-sand-200 bg-sand-50 p-4" onSubmit={upload}>
        <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
          <Field label="Photo file">
            <Input
              accept="image/jpeg,image/png,image/webp"
              disabled={!canUpload}
              name="file"
              onChange={(event) => setNewPhotoFile(event.currentTarget.files?.[0] ?? null)}
              type="file"
            />
          </Field>
          <Field label="New photo alt text">
            <Input
              disabled={!canUpload}
              maxLength={200}
              minLength={5}
              name="altText"
              onChange={(event) => setNewPhotoAltText(event.currentTarget.value)}
              placeholder="Covered pickleball courts with bright baseline markings"
              value={newPhotoAltText}
            />
          </Field>
          <Button
            disabled={!canUpload || !newPhotoFile || newPhotoAltText.trim().length < 5}
            loading={busy === "upload"}
            type="submit"
          >
            <ImagePlus aria-hidden="true" size={16} />
            Upload photo
          </Button>
        </div>
      </form>

      {ordered.length === 0 ? (
        <p className="m-0 mt-3 rounded-[12px] border border-dashed border-sand-200 p-4 text-sm text-ink-500">
          No venue photos yet.
        </p>
      ) : (
        <ul className="m-0 mt-4 grid list-none gap-3 p-0">
          {ordered.map((photo, index) => {
            const previous = ordered[index - 1];
            const next = ordered[index + 1];
            return (
              <li
                className="grid gap-3 rounded-[12px] border border-sand-200 bg-white p-3 md:grid-cols-[160px_1fr_auto]"
                key={photo.id}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-sand-100">
                  <Image
                    alt={photo.altText}
                    className="object-cover"
                    fill
                    src={photo.url}
                    unoptimized
                  />
                </div>
                <div className="grid gap-2">
                  <Field label={`Alt text for ${photo.altText}`}>
                    <Input
                      maxLength={200}
                      minLength={5}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDrafts((current) => ({
                          ...current,
                          [photo.id]: value,
                        }));
                      }}
                      value={drafts[photo.id] ?? photo.altText}
                    />
                  </Field>
                  <div className="grid gap-1">
                    <p className="m-0 text-sm text-ink-700">{photo.altText}</p>
                    <p className="m-0 text-sm text-ink-500">Position {index + 1}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2 md:justify-end">
                  <Button
                    aria-label={`Move ${photo.altText} up`}
                    disabled={!previous || busy !== null}
                    onClick={() => previous && move(photo, previous)}
                    size="sm"
                    title={`Move ${photo.altText} up`}
                    type="button"
                    variant="secondary"
                  >
                    <ArrowUp aria-hidden="true" size={16} />
                  </Button>
                  <Button
                    aria-label={`Move ${photo.altText} down`}
                    disabled={!next || busy !== null}
                    onClick={() => next && move(photo, next)}
                    size="sm"
                    title={`Move ${photo.altText} down`}
                    type="button"
                    variant="secondary"
                  >
                    <ArrowDown aria-hidden="true" size={16} />
                  </Button>
                  <Button
                    aria-label={`Save alt text for ${photo.altText}`}
                    disabled={busy !== null}
                    onClick={() => saveAlt(photo)}
                    size="sm"
                    title={`Save alt text for ${photo.altText}`}
                    type="button"
                    variant="secondary"
                  >
                    <Save aria-hidden="true" size={16} />
                  </Button>
                  <Button
                    aria-label={`Delete ${photo.altText}`}
                    disabled={busy !== null}
                    onClick={() => remove(photo)}
                    size="sm"
                    title={`Delete ${photo.altText}`}
                    type="button"
                    variant="danger"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
