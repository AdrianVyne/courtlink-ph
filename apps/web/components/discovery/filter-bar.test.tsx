import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FilterBar, buildFilterHref } from "./filter-bar";

afterEach(cleanup);

const catalog = [
  { key: "LIGHTS", name: "Night lighting" },
  { key: "PARKING", name: "Parking" },
];

describe("buildFilterHref", () => {
  it("removes a scalar filter and keeps the rest", () => {
    expect(buildFilterHref({ city: "Cebu City", maxPrice: "500" }, { key: "city" })).toBe(
      "/courts?maxPrice=500",
    );
  });

  it("returns the bare path when the last filter is removed", () => {
    expect(buildFilterHref({ city: "Cebu City" }, { key: "city" })).toBe("/courts");
  });

  it("removes a single amenity from the list", () => {
    expect(
      buildFilterHref({ amenities: "LIGHTS,PARKING" }, { key: "amenities", value: "LIGHTS" }),
    ).toBe("/courts?amenities=PARKING");
  });

  it("drops the amenities key when the last amenity is removed", () => {
    expect(buildFilterHref({ amenities: "LIGHTS" }, { key: "amenities", value: "LIGHTS" })).toBe(
      "/courts",
    );
  });

  it("removing the date also removes the duration", () => {
    expect(buildFilterHref({ date: "2026-08-01", durationMin: "90" }, { key: "date" })).toBe(
      "/courts",
    );
  });
});

describe("FilterBar", () => {
  it("renders a removable chip per active filter with amenity names resolved", () => {
    render(
      <FilterBar
        amenityCatalog={catalog}
        params={{ city: "Cebu City", amenities: "LIGHTS" }}
        resultCount={4}
      />,
    );
    const cityChip = screen.getByRole("link", { name: "Remove filter: Cebu City" });
    expect(cityChip.getAttribute("href")).toBe("/courts?amenities=LIGHTS");
    const amenityChip = screen.getByRole("link", { name: "Remove filter: Night lighting" });
    expect(amenityChip.getAttribute("href")).toBe("/courts?city=Cebu+City");
  });

  it("shows the result count", () => {
    render(<FilterBar amenityCatalog={catalog} params={{}} resultCount={1} />);
    expect(screen.getByText("1 venue")).toBeDefined();
  });

  it("pluralizes the result count", () => {
    render(<FilterBar amenityCatalog={catalog} params={{}} resultCount={12} />);
    expect(screen.getByText("12 venues")).toBeDefined();
  });
});
