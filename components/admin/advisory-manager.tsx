"use client";

/**
 * The advisory editor (PRD Module 4).
 *
 * Kept as one client component so the "new notice" panel and the per-row edit
 * panel are literally the same form — the only difference is whether the hidden
 * `slug` field is empty. That removes the usual drift between create and update
 * validation, and it means a field added here shows up in both flows.
 *
 * Mutations go through the server actions in `actions.ts`; this component never
 * touches storage itself, so the same panel will keep working when the actions
 * are pointed at Supabase.
 */

import { useState, useTransition } from "react";
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  Megaphone,
  PencilLine,
  Pin,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import {
  saveAdvisoryAction,
  setAdvisoryArchivedAction,
} from "@/app/admin/advisories/actions";
import type { Advisory, AdvisorySeverity } from "@/lib/advisories";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Same table as `formatAdvisoryDate`, kept local so the client bundle does
 *  not pull in the server-only data module. */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthName = MONTHS[Number(month) - 1];
  return year && monthName && day ? `${day} ${monthName} ${year}` : iso;
}

const severityChip: Record<AdvisorySeverity, string> = {
  CRITICAL: "bg-alert-50 text-alert-700 ring-alert-500/25",
  WARNING: "bg-reed-50 text-reed-800 ring-reed-600/25",
  INFO: "bg-lake-50 text-lake-700 ring-lake-600/20",
};

const CATEGORIES: Advisory["category"][] = [
  "Wildlife",
  "Water",
  "Access",
  "Operations",
];

const SEVERITIES: { value: AdvisorySeverity; label: string }[] = [
  { value: "INFO", label: "Info — routine notice" },
  { value: "WARNING", label: "Warning — affects a visit" },
  { value: "CRITICAL", label: "Critical — closure or hazard" },
];

type Draft = {
  slug: string;
  title: string;
  severity: AdvisorySeverity;
  category: Advisory["category"];
  publishedAt: string;
  effectiveUntil: string;
  excerpt: string;
  body: string;
  actions: string;
  isActiveBanner: boolean;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankDraft(): Draft {
  return {
    slug: "",
    title: "",
    severity: "INFO",
    category: "Operations",
    publishedAt: todayISO(),
    effectiveUntil: "",
    excerpt: "",
    body: "",
    actions: "",
    isActiveBanner: false,
  };
}

function draftFrom(advisory: Advisory): Draft {
  return {
    slug: advisory.slug,
    title: advisory.title,
    severity: advisory.severity,
    category: advisory.category,
    publishedAt: advisory.publishedAt,
    effectiveUntil: advisory.effectiveUntil ?? "",
    excerpt: advisory.excerpt,
    body: advisory.body.join("\n\n"),
    actions: (advisory.actions ?? []).join("\n"),
    isActiveBanner: Boolean(advisory.isActiveBanner),
  };
}

type Notice = { tone: "ok" | "error"; text: string };

const fieldClass =
  "w-full rounded-xl border-0 bg-sand-50 px-3.5 py-2.5 text-[13.5px] text-ink ring-1 ring-ink/10 ring-inset outline-none transition focus:bg-white focus:ring-2 focus:ring-lake-600/40";

const labelClass =
  "block text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase";

export default function AdvisoryManager({
  published,
  archived,
}: {
  published: Advisory[];
  archived: Advisory[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setNotice(null);
    setDraft(blankDraft());
  }

  function openEdit(advisory: Advisory) {
    setNotice(null);
    setDraft(draftFrom(advisory));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveAdvisoryAction(formData);
      if (result.ok) {
        setDraft(null);
        setNotice({ tone: "ok", text: result.message });
      } else {
        setNotice({ tone: "error", text: result.message });
      }
    });
  }

  function toggleArchived(slug: string, next: boolean) {
    startTransition(async () => {
      const result = await setAdvisoryArchivedAction(slug, next);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    });
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          role="status"
          className={`flex items-start justify-between gap-4 rounded-2xl px-4 py-3 text-[13px] ring-1 ring-inset ${
            notice.tone === "ok"
              ? "bg-moss-50 text-moss-800 ring-moss-600/20"
              : "bg-alert-50 text-alert-700 ring-alert-500/25"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 rounded-full p-0.5 opacity-60 transition hover:opacity-100"
            aria-label="Dismiss message"
          >
            <X className="size-3.5" strokeWidth={2.4} />
          </button>
        </div>
      ) : null}

      {draft ? (
        <section
          aria-labelledby="advisory-editor-heading"
          className="rounded-2xl bg-white ring-1 ring-ink/8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
            <div>
              <h2
                id="advisory-editor-heading"
                className="font-display text-[19px] leading-tight text-ink"
              >
                {draft.slug ? "Edit notice" : "New notice"}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                Saving publishes straight to the public notice board.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink-soft/70 transition hover:bg-sand-100 hover:text-ink"
            >
              <X className="size-3.5" strokeWidth={2.4} />
              Cancel
            </button>
          </div>

          {/* Keyed on the slug so switching between two notices remounts the
              uncontrolled fields instead of leaving the previous values. */}
          <form
            key={draft.slug || "new"}
            onSubmit={submit}
            className="space-y-5 px-5 py-5"
          >
            <input type="hidden" name="slug" value={draft.slug} />

            <div>
              <label htmlFor="advisory-title" className={labelClass}>
                Headline
              </label>
              <input
                id="advisory-title"
                name="title"
                defaultValue={draft.title}
                maxLength={120}
                required
                placeholder="Reed beds closed to landing during the nesting season"
                className={`mt-1.5 ${fieldClass}`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="advisory-severity" className={labelClass}>
                  Severity
                </label>
                <select
                  id="advisory-severity"
                  name="severity"
                  defaultValue={draft.severity}
                  className={`mt-1.5 cursor-pointer ${fieldClass}`}
                >
                  {SEVERITIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="advisory-category" className={labelClass}>
                  Category
                </label>
                <select
                  id="advisory-category"
                  name="category"
                  defaultValue={draft.category}
                  className={`mt-1.5 cursor-pointer ${fieldClass}`}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="advisory-published" className={labelClass}>
                  Published
                </label>
                <input
                  id="advisory-published"
                  name="publishedAt"
                  type="date"
                  defaultValue={draft.publishedAt}
                  required
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor="advisory-until" className={labelClass}>
                  Expires <span className="normal-case opacity-70">(optional)</span>
                </label>
                <input
                  id="advisory-until"
                  name="effectiveUntil"
                  type="date"
                  defaultValue={draft.effectiveUntil}
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="advisory-excerpt" className={labelClass}>
                Summary <span className="normal-case opacity-70">(board card)</span>
              </label>
              <textarea
                id="advisory-excerpt"
                name="excerpt"
                defaultValue={draft.excerpt}
                rows={2}
                maxLength={320}
                required
                placeholder="One or two sentences a visitor can act on."
                className={`mt-1.5 resize-y ${fieldClass}`}
              />
            </div>

            <div>
              <label htmlFor="advisory-body" className={labelClass}>
                Body <span className="normal-case opacity-70">(blank line = new paragraph)</span>
              </label>
              <textarea
                id="advisory-body"
                name="body"
                defaultValue={draft.body}
                rows={6}
                required
                placeholder="What happened, what it means, and what the park office is doing about it."
                className={`mt-1.5 resize-y leading-relaxed ${fieldClass}`}
              />
            </div>

            <div>
              <label htmlFor="advisory-actions" className={labelClass}>
                What visitors must do <span className="normal-case opacity-70">(one per line)</span>
              </label>
              <textarea
                id="advisory-actions"
                name="actions"
                defaultValue={draft.actions}
                rows={3}
                placeholder={"Stay in the marked channel.\nNo landings in the reed beds."}
                className={`mt-1.5 resize-y leading-relaxed ${fieldClass}`}
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl bg-sand-50 px-4 py-3 ring-1 ring-ink/8 ring-inset">
              <input
                type="checkbox"
                name="isActiveBanner"
                defaultChecked={draft.isActiveBanner}
                className="mt-0.5 size-4 shrink-0 accent-moss-600"
              />
              <span className="text-[12.5px] leading-relaxed text-ink-soft/80">
                <span className="font-semibold text-ink">Pin to the site-wide banner.</span>{" "}
                Shown above every public page until you unpin it. A critical notice is
                picked up automatically even when nothing is pinned.
              </span>
            </label>

            <div className="flex items-center gap-3 border-t border-ink/8 pt-4">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[12.5px] font-semibold text-sand-50 transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Megaphone className="size-3.5" strokeWidth={2.2} />
                {pending
                  ? "Saving…"
                  : draft.slug
                    ? "Save changes"
                    : "Publish notice"}
              </button>
              <span className="text-[11.5px] text-ink-soft/55">
                {draft.slug
                  ? "The public board updates the moment you save."
                  : "It goes live on /advisories immediately."}
              </span>
            </div>
          </form>
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-ink/8">
          <div>
            <h2 className="font-display text-[19px] leading-tight text-ink">
              Notice board
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              {published.length} live · newest first · edits appear on the public site
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-sand-50 transition hover:bg-ink/85"
          >
            <Plus className="size-3.5" strokeWidth={2.4} />
            New notice
          </button>
        </div>
      )}

      <section
        aria-labelledby="advisory-live-heading"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
      >
        <div className="border-b border-ink/8 px-5 py-4">
          <h2
            id="advisory-live-heading"
            className="font-display text-[19px] leading-tight text-ink"
          >
            Published
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
            What visitors see on <span className="font-mono text-[11.5px]">/advisories</span>
          </p>
        </div>

        <ul className="divide-y divide-ink/6">
          {published.map((advisory) => (
            <li
              key={advisory.slug}
              className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-sand-50/70"
            >
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.12em] uppercase ring-1 ring-inset ${severityChip[advisory.severity]}`}
              >
                {advisory.severityLabel}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink">
                  {advisory.title}
                  {advisory.isActiveBanner ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-moss-50 px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-moss-700 uppercase ring-1 ring-moss-600/20 ring-inset">
                      <Pin className="size-2.5" strokeWidth={2.6} />
                      Banner
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-soft/60">
                  {advisory.excerpt}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft/50">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3" strokeWidth={2.2} />
                    {formatDay(advisory.publishedAt)}
                  </span>
                  <span>{advisory.category}</span>
                  {advisory.effectiveUntil ? (
                    <span>runs to {formatDay(advisory.effectiveUntil)}</span>
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(advisory)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink-soft/70 transition hover:bg-sand-100 hover:text-ink"
                >
                  <PencilLine className="size-3.5" strokeWidth={2.2} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleArchived(advisory.slug, true)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink-soft/70 transition hover:bg-alert-50 hover:text-alert-700 disabled:opacity-50"
                >
                  <Archive className="size-3.5" strokeWidth={2.2} />
                  Take down
                </button>
                <a
                  href={`/advisories/${advisory.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full p-1.5 text-ink-soft/50 transition hover:bg-sand-100 hover:text-ink"
                  aria-label={`View ${advisory.title} on the public site`}
                >
                  <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
                </a>
              </div>
            </li>
          ))}
        </ul>

        {published.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-soft/60">
            No notices are live. The public board shows an empty state until you publish one.
          </p>
        ) : null}
      </section>

      {archived.length > 0 ? (
        <section
          aria-labelledby="advisory-archived-heading"
          className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
        >
          <div className="border-b border-ink/8 px-5 py-4">
            <h2
              id="advisory-archived-heading"
              className="font-display text-[19px] leading-tight text-ink"
            >
              Archived
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Hidden from the public site, kept here so nothing is lost
            </p>
          </div>

          <ul className="divide-y divide-ink/6">
            {archived.map((advisory) => (
              <li
                key={advisory.slug}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
              >
                <span className="shrink-0 rounded-full bg-sand-100 px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.12em] text-sand-600 uppercase ring-1 ring-sand-500/25 ring-inset">
                  {advisory.severityLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink-soft/80">
                    {advisory.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-soft/45">
                    Published {formatDay(advisory.publishedAt)} · {advisory.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleArchived(advisory.slug, false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink-soft/70 transition hover:bg-moss-50 hover:text-moss-700 disabled:opacity-50"
                >
                  <RotateCcw className="size-3.5" strokeWidth={2.2} />
                  Republish
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
