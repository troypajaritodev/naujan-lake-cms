"use client";

import { useEffect, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  tourAdminInputSchema,
  type TourAdminInput,
  type TourAdminRecord,
  type TourSpeciesOption,
} from "@/lib/tour-validation";
import type { ItineraryStop, TourDifficulty } from "@/lib/tours";

type TourFormState = Omit<
  TourAdminInput,
  "slug" | "ratePerPerson" | "maxCapacity" | "tariff"
> & {
  slug: string;
  slugManuallyEdited: boolean;
  ratePerPerson: string;
  maxCapacity: string;
  tariff: Array<{ label: string; amount: string }>;
};

type TourEditorDialogProps = {
  tour: TourAdminRecord | null;
  categories: string[];
  durations: string[];
  departures: string[];
  species: TourSpeciesOption[];
  onClose: () => void;
  onSave: (input: TourAdminInput) => Promise<void>;
};

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-[13px] text-ink outline-none transition focus:border-lake-700 focus:ring-2 focus:ring-lake-700/15";
const textAreaClass = `${fieldClass} resize-y leading-relaxed`;
const labelClass = "block text-[11.5px] font-semibold text-ink";
const sectionClass = "rounded-2xl border border-ink/8 bg-white p-4 sm:p-5";
const sectionHeadingClass = "font-display text-[18px] text-ink";

function emptyInput(): TourFormState {
  return {
    title: "",
    slug: "",
    slugManuallyEdited: false,
    category: "",
    summary: "",
    duration: "",
    departure: "",
    ratePerPerson: "0",
    maxCapacity: "1",
    difficulty: "EASY",
    inclusions: [],
    whatToBring: [],
    notes: [],
    speciesSlugs: [],
    itinerary: [],
    tariff: [],
    featuredImage: "/images/shoreline.jpg",
  };
}

function toFormState(tour: TourAdminRecord): TourFormState {
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    slugManuallyEdited: false,
    category: tour.category,
    summary: tour.summary,
    duration: tour.duration,
    departure: tour.departure,
    ratePerPerson: String(tour.ratePerPerson),
    maxCapacity: String(tour.maxCapacity),
    difficulty: tour.difficulty,
    inclusions: [...tour.inclusions],
    whatToBring: [...tour.bring],
    notes: [...tour.notes],
    speciesSlugs: [...tour.speciesSlugs],
    itinerary: tour.itinerary.map((stop) => ({ ...stop })),
    tariff: tour.tariff.map((line) => ({
      label: line.label,
      amount: String(line.amount),
    })),
    featuredImage: tour.image,
  };
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function numberValue(value: string) {
  return value.trim() ? Number(value) : Number.NaN;
}

function makePayload(input: TourFormState): TourAdminInput {
  return {
    id: input.id,
    title: input.title,
    slug: input.slug,
    category: input.category,
    summary: input.summary,
    duration: input.duration,
    departure: input.departure,
    ratePerPerson: numberValue(input.ratePerPerson),
    maxCapacity: numberValue(input.maxCapacity),
    difficulty: input.difficulty,
    inclusions: input.inclusions,
    whatToBring: input.whatToBring,
    notes: input.notes,
    speciesSlugs: input.speciesSlugs,
    itinerary: input.itinerary,
    tariff: input.tariff.map((line) => ({
      label: line.label,
      amount: numberValue(line.amount),
    })),
    featuredImage: input.featuredImage,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

function validationErrorsFor(input: TourAdminInput) {
  const result = tourAdminInputSchema.safeParse(input);
  if (result.success) return {};

  return result.error.issues.reduce<Record<string, string>>((errors, issue) => {
    const path = issue.path.join(".");
    if (!errors[path]) errors[path] = issue.message;
    return errors;
  }, {});
}

function StringListEditor({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const fieldId = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <fieldset className="space-y-2">
      <legend className={labelClass}>{label}</legend>
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${fieldId}-${index}`}>
            {label} item {index + 1}
          </label>
          <input
            id={`${fieldId}-${index}`}
            value={value}
            onChange={(event) =>
              onChange(
                values.map((entry, entryIndex) =>
                  entryIndex === index ? event.target.value : entry,
                ),
              )
            }
            placeholder={placeholder}
            className={fieldClass}
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, entryIndex) => entryIndex !== index))}
            aria-label={`Remove ${label.toLowerCase()} item ${index + 1}`}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-sand-600 hover:bg-alert-50 hover:text-alert-700 focus-visible:outline-2 focus-visible:outline-alert-700"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-lake-800 hover:bg-lake-50 focus-visible:outline-2 focus-visible:outline-lake-700"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add item
      </button>
    </fieldset>
  );
}

export default function TourEditorDialog({
  tour,
  categories,
  durations,
  departures,
  species,
  onClose,
  onSave,
}: TourEditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState<TourFormState>(() =>
    tour ? toFormState(tour) : emptyInput(),
  );
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) dialog.showModal();
    titleInputRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function update<K extends keyof TourFormState>(key: K, value: TourFormState[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setValidationErrors({});
  }

  function updateTitle(title: string) {
    setInput((current) => ({
      ...current,
      title,
      slug: current.slugManuallyEdited ? current.slug : slugify(title),
    }));
    setValidationErrors({});
  }

  function updateItinerary(
    index: number,
    key: keyof ItineraryStop,
    value: string,
  ) {
    setInput((current) => ({
      ...current,
      itinerary: current.itinerary.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, [key]: value } : stop,
      ),
    }));
    setValidationErrors({});
  }

  function moveItinerary(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= input.itinerary.length) return;

    const itinerary = [...input.itinerary];
    [itinerary[index], itinerary[destination]] = [
      itinerary[destination],
      itinerary[index],
    ];
    update("itinerary", itinerary);
  }

  function updateTariff(index: number, key: "label" | "amount", value: string) {
    setInput((current) => ({
      ...current,
      tariff: current.tariff.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }));
    setValidationErrors({});
  }

  function toggleSpecies(slug: string) {
    const selected = input.speciesSlugs.includes(slug);
    update(
      "speciesSlugs",
      selected
        ? input.speciesSlugs.filter((entry) => entry !== slug)
        : [...input.speciesSlugs, slug],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const payload = makePayload(input);
    const errors = validationErrorsFor(payload);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Review the highlighted fields before saving.");
      return;
    }

    setSaving(true);
    try {
      await onSave(payload);
      setSaving(false);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (!saving) onClose();
  }

  function fieldError(name: string) {
    return (
      validationErrors[name] ??
      Object.entries(validationErrors).find(([path]) => path.startsWith(`${name}.`))?.[1]
    );
  }

  const filteredSpecies = species.filter((entry) => {
    const search = speciesSearch.trim().toLowerCase();
    return (
      !search ||
      entry.commonName.toLowerCase().includes(search) ||
      entry.scientificName.toLowerCase().includes(search) ||
      entry.slug.toLowerCase().includes(search)
    );
  });
  const tariffTotal = input.tariff.reduce(
    (total, line) => total + (Number(line.amount) || 0),
    0,
  );
  const peso = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="tour-editor-heading"
      onCancel={handleCancel}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[calc(100%-1rem)] max-w-5xl overflow-hidden rounded-2xl border-0 bg-sand-50 p-0 text-ink shadow-2xl backdrop:bg-ink/60 sm:w-[calc(100%-3rem)] sm:rounded-3xl"
    >
      <form
        onSubmit={submit}
        noValidate
        className="flex max-h-[92dvh] flex-col"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink/8 bg-white px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <p className="text-[9.5px] font-semibold tracking-[0.18em] text-sand-600 uppercase">
              Tour package
            </p>
            <h2
              id="tour-editor-heading"
              className="mt-1 font-display text-[23px] text-ink sm:text-[26px]"
            >
              {tour ? "Edit tour package" : "New tour package"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close tour editor"
            className="grid size-9 shrink-0 place-items-center rounded-full text-sand-600 hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-lake-700 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-7 sm:py-6">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-alert-500/15 bg-alert-50 px-4 py-3 text-[12.5px] text-alert-700"
            >
              {error}
            </p>
          )}
          {Object.keys(validationErrors).length > 0 && (
            <ul
              aria-label="Tour validation errors"
              className="list-inside list-disc rounded-xl bg-alert-50 px-4 py-3 text-[11px] text-alert-700"
            >
              {Object.entries(validationErrors).map(([field, message]) => (
                <li key={field}>
                  {field}: {message}
                </li>
              ))}
            </ul>
          )}

          <section aria-labelledby="tour-basic-heading" className={sectionClass}>
            <h3 id="tour-basic-heading" className={sectionHeadingClass}>
              1. Basic information
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label htmlFor="tour-title" className={labelClass}>
                Tour title *
                <input
                  ref={titleInputRef}
                  id="tour-title"
                  required
                  value={input.title}
                  onChange={(event) => updateTitle(event.target.value)}
                  className={fieldClass}
                  aria-invalid={Boolean(fieldError("title"))}
                />
              </label>
              <label htmlFor="tour-slug" className={labelClass}>
                URL slug *
                <input
                  id="tour-slug"
                  required
                  value={input.slug}
                  onChange={(event) => {
                    setInput((current) => ({
                      ...current,
                      slug: event.target.value,
                      slugManuallyEdited: true,
                    }));
                    setValidationErrors({});
                  }}
                  className={`${fieldClass} font-mono`}
                  aria-invalid={Boolean(fieldError("slug"))}
                />
                <span className="mt-1 block text-[10.5px] font-normal text-ink-soft/65">
                  Generated from the title until you edit it.
                </span>
              </label>
              <label htmlFor="tour-category" className={labelClass}>
                Category *
                <input
                  id="tour-category"
                  required
                  list="tour-category-options"
                  value={input.category}
                  onChange={(event) => update("category", event.target.value)}
                  className={fieldClass}
                  placeholder="Search or enter a category"
                  aria-invalid={Boolean(fieldError("category"))}
                />
                <datalist id="tour-category-options">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </label>
              <label htmlFor="tour-image" className={labelClass}>
                Featured image path or HTTPS URL *
                <input
                  id="tour-image"
                  required
                  value={input.featuredImage}
                  onChange={(event) => update("featuredImage", event.target.value)}
                  className={fieldClass}
                  aria-invalid={Boolean(fieldError("featuredImage"))}
                />
              </label>
              <label
                htmlFor="tour-summary"
                className={`${labelClass} sm:col-span-2`}
              >
                Visitor-facing summary *
                <textarea
                  id="tour-summary"
                  required
                  rows={3}
                  value={input.summary}
                  onChange={(event) => update("summary", event.target.value)}
                  className={textAreaClass}
                  aria-invalid={Boolean(fieldError("summary"))}
                />
              </label>
            </div>
          </section>

          <section aria-labelledby="tour-details-heading" className={sectionClass}>
            <h3 id="tour-details-heading" className={sectionHeadingClass}>
              2. Tour details and availability
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label htmlFor="tour-duration" className={labelClass}>
                Duration *
                <input
                  id="tour-duration"
                  required
                  list="tour-duration-options"
                  value={input.duration}
                  onChange={(event) => update("duration", event.target.value)}
                  className={fieldClass}
                  placeholder="Search or enter duration"
                  aria-invalid={Boolean(fieldError("duration"))}
                />
                <datalist id="tour-duration-options">
                  {durations.map((duration) => (
                    <option key={duration} value={duration} />
                  ))}
                </datalist>
              </label>
              <label htmlFor="tour-departure" className={labelClass}>
                Departure *
                <input
                  id="tour-departure"
                  required
                  list="tour-departure-options"
                  value={input.departure}
                  onChange={(event) => update("departure", event.target.value)}
                  className={fieldClass}
                  placeholder="Search or enter departure details"
                  aria-invalid={Boolean(fieldError("departure"))}
                />
                <datalist id="tour-departure-options">
                  {departures.map((departure) => (
                    <option key={departure} value={departure} />
                  ))}
                </datalist>
              </label>
              <label htmlFor="tour-difficulty" className={labelClass}>
                Difficulty *
                <select
                  id="tour-difficulty"
                  value={input.difficulty}
                  onChange={(event) =>
                    update("difficulty", event.target.value as TourDifficulty)
                  }
                  className={fieldClass}
                >
                  <option value="EASY">Easy</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="CHALLENGING">Challenging</option>
                </select>
              </label>
            </div>
          </section>

          <section aria-labelledby="tour-pricing-heading" className={sectionClass}>
            <h3 id="tour-pricing-heading" className={sectionHeadingClass}>
              3. Pricing and capacity
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label htmlFor="tour-rate" className={labelClass}>
                Rate per person (PHP) *
                <input
                  id="tour-rate"
                  required
                  type="number"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  inputMode="decimal"
                  value={input.ratePerPerson}
                  onChange={(event) =>
                    update("ratePerPerson", event.target.value)
                  }
                  className={fieldClass}
                  aria-invalid={
                    Boolean(fieldError("ratePerPerson")) ||
                    Boolean(fieldError("tariff"))
                  }
                />
              </label>
              <label htmlFor="tour-capacity" className={labelClass}>
                Maximum capacity (1–60 guests) *
                <input
                  id="tour-capacity"
                  required
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  inputMode="numeric"
                  value={input.maxCapacity}
                  onChange={(event) => update("maxCapacity", event.target.value)}
                  className={fieldClass}
                  aria-invalid={Boolean(fieldError("maxCapacity"))}
                />
              </label>
            </div>
          </section>

          <section aria-labelledby="tour-inclusions-heading" className={sectionClass}>
            <h3 id="tour-inclusions-heading" className={sectionHeadingClass}>
              4. Inclusions and requirements
            </h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <StringListEditor
                label="Inclusions"
                values={input.inclusions}
                placeholder="e.g. Licensed guide"
                onChange={(values) => update("inclusions", values)}
              />
              <StringListEditor
                label="What to bring"
                values={input.whatToBring}
                placeholder="e.g. Reusable water bottle"
                onChange={(values) => update("whatToBring", values)}
              />
              <div className="md:col-span-2">
                <StringListEditor
                  label="Notes and requirements"
                  values={input.notes}
                  placeholder="Add a visitor note"
                  onChange={(values) => update("notes", values)}
                />
              </div>
            </div>
          </section>

          <section aria-labelledby="tour-species-heading" className={sectionClass}>
            <h3 id="tour-species-heading" className={sectionHeadingClass}>
              5. Related wildlife species
            </h3>
            <p className="mt-1 text-[11.5px] text-ink-soft/70">
              Search the Supabase wildlife catalogue and select all that apply.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {input.speciesSlugs.map((slug) => {
                const selected = species.find((entry) => entry.slug === slug);
                const label = selected
                  ? selected.commonName
                  : `Unavailable species · ${slug}`;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => toggleSpecies(slug)}
                    aria-label={`Remove ${label}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lake-50 px-3 py-1.5 text-[11px] font-medium text-lake-900 ring-1 ring-lake-800/10 hover:bg-lake-100 focus-visible:outline-2 focus-visible:outline-lake-700"
                  >
                    {label}
                    <X className="size-3" aria-hidden="true" />
                  </button>
                );
              })}
              {input.speciesSlugs.length === 0 && (
                <span className="text-[11px] text-ink-soft/60">
                  No related species selected.
                </span>
              )}
            </div>
            <label htmlFor="species-search" className="sr-only">
              Search wildlife species
            </label>
            <span className="mt-3 flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-3">
              <Search className="size-4 shrink-0 text-sand-500" aria-hidden="true" />
              <input
                id="species-search"
                type="search"
                value={speciesSearch}
                onChange={(event) => setSpeciesSearch(event.target.value)}
                placeholder="Search by common or scientific name"
                className="w-full bg-transparent py-2.5 text-[12.5px] outline-none"
              />
            </span>
            <div
              role="group"
              aria-label="Available wildlife species"
              className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-ink/8 bg-sand-50 p-2"
            >
              {filteredSpecies.map((entry) => {
                const checked = input.speciesSlugs.includes(entry.slug);
                return (
                  <label
                    key={entry.slug}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSpecies(entry.slug)}
                      className="mt-0.5 size-4 accent-lake-800"
                    />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-ink">
                        {entry.commonName}
                      </span>
                      <span className="block text-[10.5px] italic text-ink-soft/65">
                        {entry.scientificName}
                      </span>
                    </span>
                  </label>
                );
              })}
              {filteredSpecies.length === 0 && (
                <p className="px-2.5 py-4 text-center text-[11px] text-ink-soft/65">
                  {species.length === 0
                    ? "No species records are available in Supabase."
                    : "No species match this search."}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="tour-itinerary-heading" className={sectionClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="tour-itinerary-heading" className={sectionHeadingClass}>
                  6. Itinerary
                </h3>
                <p className="mt-1 text-[11.5px] text-ink-soft/70">
                  Add stops in visitor order. Time or duration is stored in the
                  existing itinerary field.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  update("itinerary", [
                    ...input.itinerary,
                    { time: "", title: "", detail: "" },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-lake-800/20 px-3 py-2 text-[11px] font-semibold text-lake-900 hover:bg-lake-50 focus-visible:outline-2 focus-visible:outline-lake-700"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add stop
              </button>
            </div>
            <ol className="mt-4 space-y-3">
              {input.itinerary.map((stop, index) => (
                <li key={index}>
                  <fieldset className="rounded-xl border border-ink/8 bg-sand-50 p-3 sm:p-4">
                    <legend className="sr-only">Itinerary stop {index + 1}</legend>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-lake-900 text-[11px] font-semibold text-white">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveItinerary(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move stop ${index + 1} up`}
                          className="grid size-8 place-items-center rounded-lg text-lake-900 hover:bg-lake-50 focus-visible:outline-2 focus-visible:outline-lake-700 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <ChevronUp className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItinerary(index, 1)}
                          disabled={index === input.itinerary.length - 1}
                          aria-label={`Move stop ${index + 1} down`}
                          className="grid size-8 place-items-center rounded-lg text-lake-900 hover:bg-lake-50 focus-visible:outline-2 focus-visible:outline-lake-700 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <ChevronDown className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            update(
                              "itinerary",
                              input.itinerary.filter(
                                (_, stopIndex) => stopIndex !== index,
                              ),
                            )
                          }
                          aria-label={`Remove stop ${index + 1}`}
                          className="grid size-8 place-items-center rounded-lg text-sand-600 hover:bg-alert-50 hover:text-alert-700 focus-visible:outline-2 focus-visible:outline-alert-700"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(130px,0.35fr)_1fr]">
                      <label htmlFor={`stop-time-${index}`} className={labelClass}>
                        Time or duration *
                        <input
                          id={`stop-time-${index}`}
                          required
                          value={stop.time}
                          onChange={(event) =>
                            updateItinerary(index, "time", event.target.value)
                          }
                          className={fieldClass}
                          placeholder="e.g. 05:30"
                          aria-invalid={Boolean(fieldError(`itinerary.${index}.time`))}
                        />
                      </label>
                      <label htmlFor={`stop-title-${index}`} className={labelClass}>
                        Stop title *
                        <input
                          id={`stop-title-${index}`}
                          required
                          value={stop.title}
                          onChange={(event) =>
                            updateItinerary(index, "title", event.target.value)
                          }
                          className={fieldClass}
                          aria-invalid={Boolean(fieldError(`itinerary.${index}.title`))}
                        />
                      </label>
                      <label
                        htmlFor={`stop-detail-${index}`}
                        className={`${labelClass} sm:col-span-2`}
                      >
                        Description *
                        <textarea
                          id={`stop-detail-${index}`}
                          required
                          rows={2}
                          value={stop.detail}
                          onChange={(event) =>
                            updateItinerary(index, "detail", event.target.value)
                          }
                          className={textAreaClass}
                          aria-invalid={Boolean(fieldError(`itinerary.${index}.detail`))}
                        />
                      </label>
                    </div>
                  </fieldset>
                </li>
              ))}
              {input.itinerary.length === 0 && (
                <li className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-[12px] text-ink-soft/65">
                  No itinerary stops yet. Add the first stop to build the route.
                </li>
              )}
            </ol>
          </section>

          <section aria-labelledby="tour-tariff-heading" className={sectionClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="tour-tariff-heading" className={sectionHeadingClass}>
                  7. Tariff breakdown
                </h3>
                <p className="mt-1 text-[11.5px] text-ink-soft/70">
                  Line items must add up to the configured per-person rate.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  update("tariff", [...input.tariff, { label: "", amount: "" }])
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-lake-800/20 px-3 py-2 text-[11px] font-semibold text-lake-900 hover:bg-lake-50 focus-visible:outline-2 focus-visible:outline-lake-700"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add tariff line
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {input.tariff.map((line, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(0,1fr)_132px_36px] items-end gap-2"
                >
                  <label htmlFor={`tariff-label-${index}`} className={labelClass}>
                    Item label *
                    <input
                      id={`tariff-label-${index}`}
                      required
                      value={line.label}
                      onChange={(event) => updateTariff(index, "label", event.target.value)}
                      className={fieldClass}
                      placeholder="e.g. Boat rental"
                      aria-invalid={Boolean(fieldError(`tariff.${index}.label`))}
                    />
                  </label>
                  <label htmlFor={`tariff-amount-${index}`} className={labelClass}>
                    Amount (PHP) *
                    <input
                      id={`tariff-amount-${index}`}
                      required
                      type="number"
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(event) => updateTariff(index, "amount", event.target.value)}
                      className={fieldClass}
                      aria-invalid={Boolean(fieldError(`tariff.${index}.amount`))}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "tariff",
                        input.tariff.filter((_, lineIndex) => lineIndex !== index),
                      )
                    }
                    aria-label={`Remove tariff line ${index + 1}`}
                    className="mb-0.5 grid size-9 place-items-center rounded-lg text-sand-600 hover:bg-alert-50 hover:text-alert-700 focus-visible:outline-2 focus-visible:outline-alert-700"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              {input.tariff.length === 0 && (
                <p className="rounded-lg bg-sand-50 px-3 py-4 text-center text-[11.5px] text-ink-soft/65">
                  No tariff lines. Add items that sum to the rate per person.
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-lake-950 px-4 py-3 text-[12px] text-sand-50">
              <span>
                Tariff total <strong className="ml-1">{peso.format(tariffTotal)}</strong>
              </span>
              <span>
                Configured rate{" "}
                <strong className="ml-1">
                  {peso.format(Number(input.ratePerPerson) || 0)}
                </strong>
              </span>
            </div>
            {fieldError("tariff") && (
              <p role="alert" className="mt-2 text-[11px] text-alert-700">
                {fieldError("tariff")}
              </p>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-ink/8 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-7 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-ink/15 px-5 py-2.5 text-[12px] font-semibold text-ink-soft hover:bg-sand-50 focus-visible:outline-2 focus-visible:outline-lake-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-lake-900 px-5 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-lake-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lake-700 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : tour ? "Save changes" : "Save tour"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
