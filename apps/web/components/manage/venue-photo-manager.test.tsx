import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../ui";
import { VenuePhotoManager } from "./venue-photo-manager";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const photos = [
  {
    id: "photo-1",
    altText: "Front court",
    position: 0,
    url: "/api/v1/venue-photos/photo-1",
  },
  {
    id: "photo-2",
    altText: "Side court",
    position: 2,
    url: "/api/v1/venue-photos/photo-2",
  },
];

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}

describe("VenuePhotoManager", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    refresh.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uploads a venue photo with multipart form data", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          id: "photo-3",
          altText: "Sunny indoor court",
          position: 3,
          url: "/api/v1/venue-photos/photo-3",
        },
        { status: 201 },
      ),
    );
    render(
      <ToastProvider>
        <VenuePhotoManager venueId="venue-1" photos={photos} />
      </ToastProvider>,
    );

    const file = new File(["image"], "court.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photo file"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("New photo alt text"), {
      target: { value: "Sunny indoor court" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload photo" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/v1/venues/venue-1/photos");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("altText")).toBe("Sunny indoor court");
    expect((init.body as FormData).get("file")).toBe(file);
    expect(init.headers).not.toEqual(
      expect.objectContaining({ "Content-Type": expect.anything() }),
    );
    await screen.findByText("Sunny indoor court");
  });

  it("edits alt text and moves photos using PATCH requests", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: "photo-2",
          altText: "Covered side court",
          position: 2,
          url: "/api/v1/venue-photos/photo-2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "photo-2",
          altText: "Covered side court",
          position: 0,
          url: "/api/v1/venue-photos/photo-2",
        }),
      );
    render(
      <ToastProvider>
        <VenuePhotoManager venueId="venue-1" photos={photos} />
      </ToastProvider>,
    );

    fireEvent.change(screen.getByLabelText("Alt text for Side court"), {
      target: { value: "Covered side court" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save alt text for Side court" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/venues/venue-1/photos/photo-2",
        expect.objectContaining({
          body: JSON.stringify({ altText: "Covered side court" }),
          credentials: "include",
          method: "PATCH",
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Covered side court up" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/v1/venues/venue-1/photos/photo-2",
        expect.objectContaining({
          body: JSON.stringify({ position: 0 }),
          credentials: "include",
          method: "PATCH",
        }),
      ),
    );
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("deletes existing photos", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(
      <ToastProvider>
        <VenuePhotoManager venueId="venue-1" photos={photos} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Front court" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/venues/venue-1/photos/photo-1",
        expect.objectContaining({ credentials: "include", method: "DELETE" }),
      ),
    );
    expect(screen.queryByText("Front court")).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
