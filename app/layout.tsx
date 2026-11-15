
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { AuthProvider } from "@/components/auth-provider";
import SiteChrome from "@/components/site-chrome";
import { getBannerAdvisory } from "@/lib/advisories";
import { site } from "@/lib/site";
import "./globals.css";

const geistSans = localFont({
  src: "../public/fonts/geist-variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../public/fonts/geist-mono-variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

const fraunces = localFont({
  src: [
    {
      path: "../public/fonts/fraunces-variable.woff2",
      style: "normal",
    },
    {
      path: "../public/fonts/fraunces-variable-italic.woff2",
      style: "italic",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: `${site.park} · Visitor Hub`,
    template: `%s · ${site.park}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "Naujan Lake",
    "Naujan Lake National Park",
    "Oriental Mindoro",
    "Ramsar site",
    "Philippines wetlands",
    "birdwatching Philippines",
    "eco-tourism Mindoro",
    "wildlife catalog",
  ],
  authors: [{ name: "Naujan Lake National Park" }],
  openGraph: {
    type: "website",
    locale: "en_PH",
    siteName: site.name,
    title: `${site.park} · Visitor Hub`,
    description: site.description,
    images: [
      {
        url: "/images/hero-lake.jpg",
        width: 1080,
        height: 692,
        alt: "Open water and mountains at Naujan Lake National Park",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.park} · Visitor Hub`,
    description: site.description,
    images: ["/images/hero-lake.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#08211f",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const banner = await getBannerAdvisory();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-sand-50 font-sans text-ink">
        <a
          href="#main"
          className="sr-only rounded-full bg-lake-900 px-5 py-3 text-sm font-semibold text-sand-50 focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100"
        >
          Skip to content
        </a>
        <AuthProvider>
          <SiteChrome banner={banner}>{children}</SiteChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
