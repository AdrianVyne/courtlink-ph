import type { PublicCoachDetail, RatingSummary, VenueSummary } from "./api";
import { absoluteUrl, siteUrl } from "./site";

type JsonLd = Record<string, unknown>;

/** Serializes JSON-LD for a <script> tag; escapes "<" so user-authored text cannot close the tag. */
export function jsonLdScript(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function aggregateRating(rating: RatingSummary): JsonLd | undefined {
  if (rating.count === 0) return undefined;
  return {
    "@type": "AggregateRating",
    ratingValue: rating.average,
    reviewCount: rating.count,
    bestRating: 5,
    worstRating: 1,
  };
}

export function venueJsonLd(venue: VenueSummary, rating: RatingSummary): JsonLd {
  const data: JsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: venue.name,
    url: absoluteUrl(`/courts/${venue.slug}`),
    sport: "Pickleball",
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.streetAddress,
      addressLocality: venue.cityMunicipality,
      addressCountry: "PH",
    },
  };
  if (venue.description) data.description = venue.description;
  const rated = aggregateRating(rating);
  if (rated) data.aggregateRating = rated;
  return data;
}

export function coachJsonLd(coach: PublicCoachDetail, rating: RatingSummary): JsonLd {
  const data: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Pickleball coaching",
    url: absoluteUrl(`/coaches/${coach.id}`),
    provider: {
      "@type": "Person",
      name: coach.displayName,
    },
    areaServed: { "@type": "Country", name: "Philippines" },
    offers: {
      "@type": "Offer",
      price: coach.hourlyRate,
      priceCurrency: "PHP",
    },
  };
  if (coach.bio) data.description = coach.bio;
  const rated = aggregateRating(rating);
  if (rated) data.aggregateRating = rated;
  return data;
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "CourtLink PH",
        url: siteUrl(),
        logo: absoluteUrl("/icon.svg"),
        description:
          "Marketplace for booking pickleball courts and coaches across the Philippines.",
      },
      {
        "@type": "WebSite",
        name: "CourtLink PH",
        url: siteUrl(),
      },
    ],
  };
}
