import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { ServiceWorkerRegistration } from "../components/service-worker-registration";
import { ToastProvider } from "../components/ui/toast";
import { jsonLdScript, organizationJsonLd } from "../lib/jsonld";
import { siteUrl } from "../lib/site";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display-face" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "CourtLink PH — Pickleball courts and coaches",
    template: "%s — CourtLink PH",
  },
  description: "Find and book pickleball courts and coaches across the Philippines.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  openGraph: {
    siteName: "CourtLink PH",
    type: "website",
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport = { themeColor: "#236b48" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} ${display.variable}`}>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD, no user input
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
          type="application/ld+json"
        />
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
