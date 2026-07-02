import { describe, expect, it } from "vitest";
import type { PublicCoachDetail, RatingSummary, VenueSummary } from "./api";
import { coachJsonLd, jsonLdScript, organizationJsonLd, venueJsonLd } from "./jsonld";

const venue: VenueSummary = {
  id: "venue-1",
  businessId: "biz-1",
  name: "Riverside Pickle Club",
  slug: "riverside-pickle-club",
  description: "Covered courts by the river.",
  status: "APPROVED",
  regionCode: "07",
  provinceCode: "0722",
  cityMunicipality: "Cebu City",
  barangay: "Lahug",
  streetAddress: "12 Riverside Drive",
  timezone: "Asia/Manila",
  approvedAt: "2026-01-15T00:00:00.000Z",
};

const coach: PublicCoachDetail = {
  id: "coach-1",
  displayName: "Sam Reyes",
  bio: "PPR-certified coach.",
  experience: "5 years",
  hourlyRate: 900,
  verificationStatus: "VERIFIED",
  availability: [],
};

const noReviews: RatingSummary = { average: 0, count: 0 };
const someReviews: RatingSummary = { average: 4.6, count: 12 };

describe("venueJsonLd", () => {
  it("describes the venue as a SportsActivityLocation with its address", () => {
    const data = venueJsonLd(venue, noReviews);
    expect(data["@type"]).toBe("SportsActivityLocation");
    expect(data.name).toBe("Riverside Pickle Club");
    const address = data.address as Record<string, unknown>;
    expect(address["@type"]).toBe("PostalAddress");
    expect(address.addressLocality).toBe("Cebu City");
    expect(address.streetAddress).toBe("12 Riverside Drive");
    expect(address.addressCountry).toBe("PH");
  });

  it("links to the venue detail page with an absolute url", () => {
    const data = venueJsonLd(venue, noReviews);
    expect(data.url).toMatch(/^https?:\/\/.+\/courts\/riverside-pickle-club$/);
  });

  it("omits aggregateRating when there are no reviews", () => {
    const data = venueJsonLd(venue, noReviews);
    expect(data).not.toHaveProperty("aggregateRating");
  });

  it("includes aggregateRating when reviews exist", () => {
    const data = venueJsonLd(venue, someReviews);
    const rating = data.aggregateRating as Record<string, unknown>;
    expect(rating["@type"]).toBe("AggregateRating");
    expect(rating.ratingValue).toBe(4.6);
    expect(rating.reviewCount).toBe(12);
  });
});

describe("coachJsonLd", () => {
  it("describes coaching as a Service provided by a Person with a PHP offer", () => {
    const data = coachJsonLd(coach, noReviews);
    expect(data["@type"]).toBe("Service");
    const provider = data.provider as Record<string, unknown>;
    expect(provider["@type"]).toBe("Person");
    expect(provider.name).toBe("Sam Reyes");
    const offers = data.offers as Record<string, unknown>;
    expect(offers.price).toBe(900);
    expect(offers.priceCurrency).toBe("PHP");
  });

  it("only carries aggregateRating when reviews exist", () => {
    expect(coachJsonLd(coach, noReviews)).not.toHaveProperty("aggregateRating");
    const rated = coachJsonLd(coach, someReviews);
    expect(rated.aggregateRating).toMatchObject({ ratingValue: 4.6, reviewCount: 12 });
  });
});

describe("jsonLdScript", () => {
  it("escapes script-closing sequences in user-authored text", () => {
    const data = venueJsonLd(
      { ...venue, description: 'nice courts</script><img src=x onerror="x">' },
      noReviews,
    );
    const html = jsonLdScript(data);
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<img");
    expect(JSON.parse(html)).toMatchObject({
      description: 'nice courts</script><img src=x onerror="x">',
    });
  });
});

describe("organizationJsonLd", () => {
  it("names the organization and its site", () => {
    const data = organizationJsonLd();
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    const org = graph.find((node) => node["@type"] === "Organization");
    const site = graph.find((node) => node["@type"] === "WebSite");
    expect(org?.name).toBe("CourtLink PH");
    expect(typeof site?.url).toBe("string");
  });
});
