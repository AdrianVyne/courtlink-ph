/** Canonical site origin; SITE_URL env in production, localhost in development. */
export function siteUrl(): string {
  const configured = process.env.SITE_URL;
  const base = configured && configured.length > 0 ? configured : "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${clean}`;
}
