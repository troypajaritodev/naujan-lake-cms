"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowUpRight, X } from "lucide-react";
import type { AdvisoryPreview } from "@/lib/advisories";

/**
 * Site-wide advisory banner (PRD FR-4.2).
 *
 * Pinned to the bottom of the viewport so it never fights the fixed header or
 * shifts the page when it appears. The layout keeps this component mounted
 * across client navigations, so dismissing it hides it for the rest of the
 * visit; the `key` in `SiteChrome` resets that when a different notice lands.
 */

const severityTone: Record<AdvisoryPreview["severity"], string> = {
  CRITICAL: "bg-alert-700 text-sand-50",
  WARNING: "bg-reed-700 text-sand-50",
  INFO: "bg-lake-800 text-sand-50",
};

export default function SiteBanner({
  advisory,
}: {
  advisory: AdvisoryPreview | null;
}) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (!advisory || dismissed || pathname.startsWith("/admin")) {
    return null;
  }

  function dismiss() {
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Active park advisory"
      className={`fixed inset-x-0 bottom-0 z-40 ${severityTone[advisory.severity]}`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-3 sm:px-8 lg:px-12">
        <AlertTriangle
          className="hidden size-5 shrink-0 sm:block"
          strokeWidth={1.8}
          aria-hidden="true"
        />

        <p className="min-w-0 flex-1 text-[12.5px] leading-snug sm:text-[13px]">
          <span className="mr-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
            {advisory.severityLabel}
          </span>
          <span className="font-medium">{advisory.title}</span>
        </p>

        <Link
          href={`/advisories/${advisory.slug}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none"
        >
          Details
          <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss advisory banner"
          className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
        >
          <X className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
