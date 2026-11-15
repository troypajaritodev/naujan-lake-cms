"use client";

/**
 * Package pricing and availability (PRD Module 2).
 *
 * The row expands into its own form rather than opening a separate panel: a
 * price change is a two-field edit, and making staff scroll to a modal for it
 * would be worse than the extra markup. The fields are uncontrolled and the row
 * remounts on open, so switching rows never leaks the previous values.
 */

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  Banknote,
  CircleSlash,
  PencilLine,
  Plus,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import {
  saveTourAction,
  setTourPublishedAction,
} from "@/app/admin/tours/actions";
import {
  TOUR_IMAGE_OPTIONS,
  type Tour,
  type TourDifficulty,
} from "@/lib/tours-meta";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const difficultyChip: Record<TourDifficulty, string> = {
  EASY: "bg-moss-50 text-moss-700 ring-moss-600/20",
  MODERATE: "bg-reed-50 text-reed-800 ring-reed-600/25",
  CHALLENGING: "bg-alert-50 text-alert-700 ring-alert-500/25",
};

const DIFFICULTIES: { value: TourDifficulty; label: string }[] = [
  { value: "EASY", label: "Easy" },
  { value: "MODERATE", label: "Moderate" },
  { value: "CHALLENGING", label: "Challenging" },
];

type Notice = { tone: "ok" | "error"; text: string };

const fieldClass =
  "w-full rounded-xl border-0 bg-sand-50 px-3.5 py-2.5 text-[13.5px] text-ink ring-1 ring-ink/10 ring-inset outline-none transition focus:bg-white focus:ring-2 focus:ring-lake-600/40";

const labelClass =
  "block text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase";

export default function TourManager({
  tours,
  unpublished,
}: {
  tours: Tour[];
  unpublished: string[];
}) {
  const [creating, setCreating] = useState(false);
  const [createImage, setCreateImage] = useState<string>(TOUR_IMAGE_OPTIONS[0].path);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();

  const offSale = new Set(unpublished);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveTourAction(formData);
      if (result.ok) {
        setCreating(false);
        setEditing(null);
        setNotice({ tone: "ok", text: result.message });
      } else {
        setNotice({ tone: "error", text: result.message });
      }
    });
  }

  function togglePublished(slug: string, published: boolean) {
    startTransition(async () => {
      const result = await setTourPublishedAction(slug, published);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    });
  }

  return (
    <div className="space-y-4">
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

      <section
        aria-labelledby="tour-list-heading"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/8 px-5 py-4">
          <div>
            <h2
              id="tour-list-heading"
              className="font-display text-[19px] leading-tight text-ink"
            >
              Tour packages
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Price and capacity feed the package page, the inquiry form and the
              revenue report
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setEditing(null);
              setCreating((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-sand-50 transition hover:bg-ink/85"
          >
            {creating ? (
              <>
                <X className="size-3.5" strokeWidth={2.2} />
                Close form
              </>
            ) : (
              <>
                <Plus className="size-3.5" strokeWidth={2.2} />
                Add package
              </>
            )}
          </button>
        </div>

        {creating ? (
          <form
            onSubmit={submit}
            className="space-y-4 border-b border-ink/8 bg-sand-50/60 px-5 py-5"
          >
            <input type="hidden" name="mode" value="create" />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-moss-700 uppercase">
                New eco-tour package
              </p>
              <span className="text-[11.5px] text-ink-soft/55">
                Published immediately to `/tours` and inquiry selectors
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="create-title" className={labelClass}>
                  Package title
                </label>
                <input
                  id="create-title"
                  name="title"
                  placeholder="e.g. Sunset mangrove kayak loop"
                  maxLength={90}
                  required
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor="create-category" className={labelClass}>
                  Category
                </label>
                <input
                  id="create-category"
                  name="category"
                  defaultValue="Eco-Tour"
                  maxLength={40}
                  required
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor="create-image" className={labelClass}>
                  Package visual
                </label>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <Image
                    src={createImage}
                    alt="Selected package preview"
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-ink/10"
                  />
                  <select
                    id="create-image"
                    name="image"
                    value={createImage}
                    onChange={(event) => setCreateImage(event.target.value)}
                    className={`cursor-pointer ${fieldClass}`}
                  >
                    {TOUR_IMAGE_OPTIONS.map((option) => (
                      <option key={option.path} value={option.path}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="create-rate" className={labelClass}>
                  Rate per person (₱)
                </label>
                <input
                  id="create-rate"
                  name="ratePerPerson"
                  type="number"
                  min={100}
                  max={50000}
                  step={1}
                  defaultValue={850}
                  required
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor="create-seats" className={labelClass}>
                  Seats per departure
                </label>
                <input
                  id="create-seats"
                  name="maxCapacity"
                  type="number"
                  min={1}
                  max={40}
                  defaultValue={10}
                  required
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor="create-duration" className={labelClass}>
                  Duration
                </label>
                <input
                  id="create-duration"
                  name="duration"
                  placeholder="e.g. 3 hours"
                  maxLength={60}
                  required
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor="create-departure" className={labelClass}>
                  Departure
                </label>
                <input
                  id="create-departure"
                  name="departure"
                  placeholder="e.g. 6:00 AM, Park Jetty"
                  maxLength={60}
                  required
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[200px_1fr_1fr]">
              <div>
                <label htmlFor="create-difficulty" className={labelClass}>
                  Difficulty
                </label>
                <select
                  id="create-difficulty"
                  name="difficulty"
                  defaultValue="EASY"
                  className={`mt-1.5 cursor-pointer ${fieldClass}`}
                >
                  {DIFFICULTIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="create-summary" className={labelClass}>
                  Summary
                </label>
                <textarea
                  id="create-summary"
                  name="summary"
                  rows={2}
                  maxLength={320}
                  placeholder="Describe the route, highlights, and what guests experience."
                  required
                  className={`mt-1.5 resize-y ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor="create-inclusions" className={labelClass}>
                  Inclusions (one per line)
                </label>
                <textarea
                  id="create-inclusions"
                  name="inclusions"
                  rows={2}
                  maxLength={1200}
                  placeholder="Licensed boat and life vest&#10;Accredited park ranger guide&#10;Park entrance fee"
                  className={`mt-1.5 resize-y ${fieldClass}`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[12.5px] font-semibold text-sand-50 transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create package"}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-full px-3 py-2 text-[12px] font-medium text-ink-soft/70 transition hover:bg-sand-100 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <ul className="divide-y divide-ink/6">
          {tours.map((tour) => {
            const isOff = offSale.has(tour.slug);
            const isEditing = editing === tour.slug;

            return (
              <li key={tour.slug} className={isOff ? "bg-sand-50/60" : ""}>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink">
                      {tour.title}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset ${difficultyChip[tour.difficulty]}`}
                      >
                        {tour.difficulty}
                      </span>
                      {isOff ? (
                        <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-sand-700 uppercase">
                          Off sale
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-soft/60">
                      {tour.summary}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft/50">
                      <span className="inline-flex items-center gap-1">
                        <Banknote className="size-3" strokeWidth={2.2} />
                        {peso.format(tour.ratePerPerson)} per person
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" strokeWidth={2.2} />
                        {tour.maxCapacity} seats
                      </span>
                      <span>{tour.duration}</span>
                      <span>{tour.departure}</span>
                      <span className="font-mono text-[10.5px]">{tour.slug}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        setEditing(isEditing ? null : tour.slug);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink-soft/70 transition hover:bg-sand-100 hover:text-ink"
                    >
                      <PencilLine className="size-3.5" strokeWidth={2.2} />
                      {isEditing ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePublished(tour.slug, isOff)}
                      disabled={pending}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition disabled:opacity-50 ${
                        isOff
                          ? "text-ink-soft/70 hover:bg-moss-50 hover:text-moss-700"
                          : "text-ink-soft/70 hover:bg-alert-50 hover:text-alert-700"
                      }`}
                    >
                      {isOff ? (
                        <RotateCcw className="size-3.5" strokeWidth={2.2} />
                      ) : (
                        <CircleSlash className="size-3.5" strokeWidth={2.2} />
                      )}
                      {isOff ? "Put on sale" : "Take off sale"}
                    </button>
                    <a
                      href={`/tours/${tour.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full p-1.5 text-ink-soft/50 transition hover:bg-sand-100 hover:text-ink"
                      aria-label={`View ${tour.title} on the public site`}
                    >
                      <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
                    </a>
                  </div>
                </div>

                {isEditing ? (
                  <form
                    key={tour.slug}
                    onSubmit={submit}
                    className="space-y-4 border-t border-ink/6 bg-sand-50/50 px-5 py-5"
                  >
                    <input type="hidden" name="mode" value="edit" />
                    <input type="hidden" name="slug" value={tour.slug} />

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor={`title-${tour.slug}`}
                          className={labelClass}
                        >
                          Package title
                        </label>
                        <input
                          id={`title-${tour.slug}`}
                          name="title"
                          defaultValue={tour.title}
                          maxLength={90}
                          required
                          className={`mt-1.5 ${fieldClass}`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`category-${tour.slug}`}
                          className={labelClass}
                        >
                          Category
                        </label>
                        <input
                          id={`category-${tour.slug}`}
                          name="category"
                          defaultValue={tour.category}
                          maxLength={40}
                          required
                          className={`mt-1.5 ${fieldClass}`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`image-${tour.slug}`}
                          className={labelClass}
                        >
                          Package visual
                        </label>
                        <select
                          id={`image-${tour.slug}`}
                          name="image"
                          defaultValue={tour.image}
                          className={`mt-1.5 cursor-pointer ${fieldClass}`}
                        >
                          {TOUR_IMAGE_OPTIONS.map((option) => (
                            <option key={option.path} value={option.path}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <label
                          htmlFor={`rate-${tour.slug}`}
                          className={labelClass}
                        >
                          Rate per person (₱)
                        </label>
                        <input
                          id={`rate-${tour.slug}`}
                          name="ratePerPerson"
                          type="number"
                          min={100}
                          max={50000}
                          step={1}
                          defaultValue={tour.ratePerPerson}
                          required
                          className={`mt-1.5 ${fieldClass}`}
                        />
                        <p className="mt-1.5 text-[11px] leading-snug text-ink-soft/50">
                          The itemised breakdown is rebalanced to match.
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor={`seats-${tour.slug}`}
                          className={labelClass}
                        >
                          Seats per departure
                        </label>
                        <input
                          id={`seats-${tour.slug}`}
                          name="maxCapacity"
                          type="number"
                          min={1}
                          max={40}
                          defaultValue={tour.maxCapacity}
                          required
                          className={`mt-1.5 ${fieldClass}`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`duration-${tour.slug}`}
                          className={labelClass}
                        >
                          Duration
                        </label>
                        <input
                          id={`duration-${tour.slug}`}
                          name="duration"
                          defaultValue={tour.duration}
                          maxLength={60}
                          required
                          className={`mt-1.5 ${fieldClass}`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`departure-${tour.slug}`}
                          className={labelClass}
                        >
                          Departure
                        </label>
                        <input
                          id={`departure-${tour.slug}`}
                          name="departure"
                          defaultValue={tour.departure}
                          maxLength={60}
                          required
                          className={`mt-1.5 ${fieldClass}`}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                      <div>
                        <label
                          htmlFor={`difficulty-${tour.slug}`}
                          className={labelClass}
                        >
                          Difficulty
                        </label>
                        <select
                          id={`difficulty-${tour.slug}`}
                          name="difficulty"
                          defaultValue={tour.difficulty}
                          className={`mt-1.5 cursor-pointer ${fieldClass}`}
                        >
                          {DIFFICULTIES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`summary-${tour.slug}`}
                          className={labelClass}
                        >
                          Summary
                        </label>
                        <textarea
                          id={`summary-${tour.slug}`}
                          name="summary"
                          defaultValue={tour.summary}
                          rows={2}
                          maxLength={320}
                          required
                          className={`mt-1.5 resize-y ${fieldClass}`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={pending}
                        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[12.5px] font-semibold text-sand-50 transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pending ? "Saving…" : "Save package"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-full px-3 py-2 text-[12px] font-medium text-ink-soft/70 transition hover:bg-sand-100 hover:text-ink"
                      >
                        Cancel
                      </button>
                      <span className="text-[11.5px] text-ink-soft/55">
                        A departure at full capacity earns{" "}
                        <span className="font-semibold text-ink">
                          {peso.format(tour.ratePerPerson * tour.maxCapacity)}
                        </span>
                        .
                      </span>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
