"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SiteBanner from "@/components/site-banner";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import type { AdvisoryPreview } from "@/lib/advisories";

/**
 * The public chrome is hidden on /admin, which renders its own CMS shell.
 */
export default function SiteChrome({
  banner,
  children,
}: {
  banner: AdvisoryPreview | null;
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return (
      <main id="main" className="min-h-svh">
        {children}
      </main>
    );
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <div className={banner ? "pb-16" : undefined}>
        <SiteFooter />
      </div>
      <SiteBanner key={banner?.slug ?? "none"} advisory={banner} />
    </>
  );
}
