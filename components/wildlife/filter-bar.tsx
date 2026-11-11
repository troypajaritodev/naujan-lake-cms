"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2, RotateCcw, Search } from "lucide-react";
import {
  conservationLabels,
  conservationStatuses,
  seasonalityLabels,
  seasonalities,
  type WildlifeGroup,
} from "@/lib/species-meta";

const fieldClass =
  "w-full rounded-xl border border-ink/12 bg-white px-3 py-2.5 text-[13px] text-ink transition-colors outline-none focus-visible:border-lake-600 focus-visible:ring-2 focus-visible:ring-lake-700/20";

const labelClass =
  "mb-1.5 block text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase";

export default function WildlifeFilterBar({
  groups,
  resultCount,
  totalCount,
}: {
  groups: WildlifeGroup[];
  resultCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const status = params.get("status") ?? "";
  const season = params.get("season") ?? "";
  const hasFilters = Boolean(q || category || status || season);

  function apply(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }

    const queryString = next.toString();
    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    apply({ q: typeof value === "string" ? value.trim() : "" });
  }

  return (
    <div
      className="rounded-2xl bg-white p-4 ring-1 ring-ink/8 sm:p-5"
      aria-busy={pending}
    >
      <form
        onSubmit={onSubmit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12"
      >
        <div className="lg:col-span-4">
          <label htmlFor="wildlife-q" className={labelClass}>
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sand-500"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <input
              key={q}
              id="wildlife-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Duck, heron, scientific nameâ€¦"
              className={`${fieldClass} pl-9`}
            />
          </div>
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="wildlife-category" className={labelClass}>
            Group
          </label>
          <select
            id="wildlife-category"
            value={category}
            onChange={(event) => apply({ category: event.target.value })}
            className={fieldClass}
          >
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group.slug} value={group.slug}>
                {group.shortName}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="wildlife-status" className={labelClass}>
            Status
          </label>
          <select
            id="wildlife-status"
            value={status}
            onChange={(event) => apply({ status: event.target.value })}
            className={fieldClass}
          >
            <option value="">Any status</option>
            {conservationStatuses.map((value) => (
              <option key={value} value={value}>
                {value} Â· {conservationLabels[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="wildlife-season" className={labelClass}>
            Season
          </label>
          <select
            id="wildlife-season"
            value={season}
            onChange={(event) => apply({ season: event.target.value })}
            className={fieldClass}
          >
            <option value="">Any season</option>
            {seasonalities.map((value) => (
              <option key={value} value={value}>
                {seasonalityLabels[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-lake-900 px-3 text-[12.5px] font-semibold text-sand-50 transition-colors hover:bg-lake-800 focus-visible:ring-2 focus-visible:ring-lake-700/40 focus-visible:outline-none disabled:opacity-60"
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <Search className="size-4" strokeWidth={2} />
            )}
            <span className="lg:sr-only">Apply</span>
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-4">
        <p
          className="text-[12.5px] text-sand-700"
          aria-live="polite"
          aria-atomic="true"
        >
          Showing{" "}
          <span className="font-semibold text-ink">{resultCount}</span> of{" "}
          {totalCount} species
        </p>

        {hasFilters ? (
          <button
            type="button"
            onClick={() =>
              apply({ q: "", category: "", status: "", season: "" })
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 px-3 py-1.5 text-[11.5px] font-medium text-ink transition-colors hover:bg-sand-100 focus-visible:ring-2 focus-visible:ring-lake-700/40 focus-visible:outline-none"
          >
            <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
