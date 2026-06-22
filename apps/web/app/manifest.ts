import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CourtLink PH",
    short_name: "CourtLink",
    description: "Book pickleball courts and coaches across the Philippines.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f4",
    theme_color: "#236b48",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
