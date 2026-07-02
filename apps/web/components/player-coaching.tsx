"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, type PlayerCoachRequest, apiFetch } from "../lib/api";
import { peso } from "../lib/format";
import { Button, Card, EmptyState, Field, Input, Select, StatusPill, useToast } from "./ui";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function PlayerCoaching({ requests }: { requests: PlayerCoachRequest[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function call(done: string, action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      push(done);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  async function postRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await call("Request posted — coaches can now send offers.", () =>
      apiFetch("/coaches/requests", {
        method: "POST",
        body: {
          startsAt: new Date(String(form.get("startsAt") ?? "")).toISOString(),
          endsAt: new Date(String(form.get("endsAt") ?? "")).toISOString(),
          location: String(form.get("location") ?? ""),
          groupSize: Number(form.get("groupSize") ?? 1),
          skillLevel: String(form.get("skillLevel") ?? "beginner"),
          goals: String(form.get("goals") ?? "") || null,
        },
      }),
    );
  }

  async function uploadProof(bookingId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Attach a screenshot of your payment.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const upload = new FormData();
      upload.set("channel", String(form.get("channel") ?? "GCASH"));
      upload.set("transactionRef", String(form.get("transactionRef") ?? ""));
      upload.set("file", file);
      const response = await fetch(`/api/v1/coaches/bookings/${bookingId}/proof-upload`, {
        method: "POST",
        body: upload,
        credentials: "include",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new ApiError(response.status, "API_ERROR", body.message ?? "Upload failed");
      }
      push("Proof submitted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col">
      {error ? (
        <p
          className="m-0 mb-4 rounded-(--radius-control) border border-danger-fg/30 bg-danger-bg px-3 py-2.5 text-sm text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <h2 className="m-0 mt-6 mb-4 font-display text-xl font-bold text-ink-900">
        Post a coaching request
      </h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={postRequest}>
        <Field label="Start">
          <Input name="startsAt" required type="datetime-local" />
        </Field>
        <Field label="End">
          <Input name="endsAt" required type="datetime-local" />
        </Field>
        <Field label="Location">
          <Input minLength={2} name="location" required type="text" />
        </Field>
        <Field label="Players">
          <Input defaultValue={2} max={64} min={1} name="groupSize" required type="number" />
        </Field>
        <Field label="Skill level">
          <Select defaultValue="beginner" name="skillLevel">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </Field>
        <Button loading={pending} size="sm" type="submit">
          Post request
        </Button>
      </form>

      <h2 className="m-0 mt-8 mb-4 font-display text-xl font-bold text-ink-900">
        Your coaching requests
      </h2>
      {requests.length === 0 ? (
        <EmptyState
          body="Post what you need above and compare coach offers."
          title="You have not posted any coaching requests"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((request) => (
            <Card className="flex flex-col gap-2 p-5" key={request.id}>
              <div className="flex items-center justify-between gap-3">
                <strong className="text-ink-900">
                  {request.groupSize} players — {request.skillLevel}
                </strong>
                <StatusPill status={request.status} />
              </div>
              <p className="m-0 text-sm text-ink-700">
                {formatWhen(request.startsAt)} at {request.location}
              </p>

              {request.status === "OPEN" && request.offers.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {request.offers
                    .filter((offer) => offer.status === "ACTIVE")
                    .map((offer) => (
                      <li
                        className="flex flex-wrap items-center gap-3 rounded-(--radius-control) bg-sand-100 px-3 py-2"
                        key={offer.id}
                      >
                        <span className="tnum font-semibold text-ink-900">
                          {peso(offer.amount)}
                        </span>
                        <span className="text-sm text-ink-500">
                          expires {formatWhen(offer.expiresAt)}
                        </span>
                        <Button
                          className="ml-auto"
                          loading={pending}
                          onClick={() =>
                            call("Offer accepted — pay the coach and upload proof.", () =>
                              apiFetch("/coaches/offers/accept", {
                                method: "POST",
                                body: { offerId: offer.id },
                              }),
                            )
                          }
                          size="sm"
                        >
                          Accept
                        </Button>
                      </li>
                    ))}
                </ul>
              ) : null}

              {request.booking && request.booking.status === "HELD" ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => uploadProof(request.booking?.id ?? "", e)}
                >
                  <p className="m-0 rounded-(--radius-control) bg-pending-bg px-3 py-2 text-sm text-pending-fg">
                    Pay the coach, then upload your proof.
                  </p>
                  <Field label="Channel">
                    <Select defaultValue="GCASH" name="channel">
                      <option value="GCASH">GCash</option>
                      <option value="MAYA">Maya</option>
                      <option value="QR_PH">QR Ph</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </Field>
                  <Field label="Reference number">
                    <Input minLength={2} name="transactionRef" required type="text" />
                  </Field>
                  <Field label="Payment screenshot">
                    <Input
                      accept="image/png,image/jpeg,image/webp"
                      name="file"
                      required
                      type="file"
                    />
                  </Field>
                  <Button className="self-start" loading={pending} size="sm" type="submit">
                    Submit proof
                  </Button>
                </form>
              ) : null}

              {request.booking && request.booking.status !== "HELD" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill status={request.booking.status} />
                  {request.booking.status === "CONFIRMED" ? (
                    <Button
                      disabled={pending}
                      onClick={() => {
                        const reason = window.prompt("Reason for the refund request?");
                        if (!reason) return;
                        void call("Refund requested.", () =>
                          apiFetch("/coaches/bookings/refund/request", {
                            method: "POST",
                            body: { bookingId: request.booking?.id, reason },
                          }),
                        );
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      Request refund
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
