import type { MetadataRoute } from "next";
import { apiFetch } from "../lib/api";
import { absoluteUrl } from "../lib/site";

const staticRoutes = [
  "/",
  "/courts",
  "/coaches",
  "/about",
  "/contact",
  "/faq",
  "/terms",
  "/privacy",
  "/login",
  "/register",
];

async function loadVenueSlugs(): Promise<string[]> {
  try {
    const venues = await apiFetch<Array<{ slug: string }>>("/venues");
    return venues.map((venue) => venue.slug);
  } catch {
    return [];
  }
}

async function loadCoachIds(): Promise<string[]> {
  try {
    const coaches = await apiFetch<Array<{ id: string }>>("/coaches");
    return coaches.map((coach) => coach.id);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [venueSlugs, coachIds] = await Promise.all([loadVenueSlugs(), loadCoachIds()]);
  return [
    ...staticRoutes.map((path) => ({ url: absoluteUrl(path) })),
    ...venueSlugs.map((slug) => ({ url: absoluteUrl(`/courts/${slug}`) })),
    ...coachIds.map((id) => ({ url: absoluteUrl(`/coaches/${id}`) })),
  ];
}
