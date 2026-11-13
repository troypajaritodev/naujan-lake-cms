"use client";

/**
 * Error boundary for the admin segment.
 *
 * Without one, a thrown server action or a failed read replaces the panel with
 * the framework's error page — and the sidebar goes with it, so the only way
 * back is to retype the URL. This keeps the frame and offers both a retry and a
 * way to the overview.
 *
 * The digest is shown because it is the only thing that ties a client report to
 * a server log; it is a hash, not a message, so nothing leaks.
 */

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-ink/8">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-alert-50 text-alert-600 ring-1 ring-alert-500/20 ring-inset">
          <AlertTriangle className="size-5" strokeWidth={1.9} aria-hidden="true" />
        </span>

        <h2 className="mt-4 font-display text-[21px] leading-tight text-ink">
          That screen did not load
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[13px] leading-relaxed text-ink-soft/70">
          Something failed while reading or saving panel data. Nothing was lost —
          try again, and if it keeps happening note the reference below.
        </p>

        {error.digest ? (
          <p className="mt-3 font-mono text-[10.5px] text-ink-soft/45">
            ref {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[12.5px] font-semibold text-sand-50 transition hover:bg-ink/85"
          >
            <RotateCcw className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-medium text-ink-soft/70 transition hover:bg-sand-100 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
            Back to the overview
          </Link>
        </div>
      </div>
    </div>
  );
}
