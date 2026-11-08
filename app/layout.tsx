import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import SiteChrome from "@/components/site-chrome";
import { site } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
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
          <SiteChrome>{children}</SiteChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
