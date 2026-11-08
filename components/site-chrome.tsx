"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

/**
 * The public chrome is hidden on /admin, which renders its own CMS shell.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
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
      <SiteFooter />
    </>
  );
}
