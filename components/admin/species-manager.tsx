"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArrowUpRight,
  Bird,
  CalendarDays,
  ImageIcon,
  MapPin,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  saveSpeciesAction,
  setSpeciesArchivedAction,
} from "@/app/admin/species/actions";
import {
  conservationLabels,
  conservationStatuses,
  seasonalities,
  seasonalityLabels,
  type ConservationStatus,
  type Seasonality,
  type Species,
  type WildlifeGroup,
} from "@/lib/species-meta";

export type PhotoOption = {
  slug: string;
  label: string;
  src: string;
  credit: string;
};

type Draft = {
  slug: string;
  commonName: string;
  localName: string;
  scientificName: string;
  group: string;
  status: ConservationStatus;
  seasonality: Seasonality;
  habitat: string;
  description: string;
  photoSrc: string;
};

type Notice = { tone: "ok" | "error"; text: string };

const fieldClass =
  "w-full rounded-xl border-0 bg-sand-50 px-3.5 py-2.5 text-[13.5px] text-ink ring-1 ring-ink/10 ring-inset outline-none transition focus:bg-white focus:ring-2 focus:ring-lake-600/40";

const labelClass =
  "block text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase";

const statusChip: Record<ConservationStatus, string> = {
  CR: "bg-alert-50 text-alert-700 ring-alert-500/25",
  EN: "bg-alert-50 text-alert-700 ring-alert-500/25",
  VU: "bg-reed-50 text-reed-800 ring-reed-600/25",
  NT: "bg-sand-100 text-sand-800 ring-sand-500/30",
  LC: "bg-moss-50 text-moss-700 ring-moss-600/25",
  DD: "bg-sand-100 text-sand-800 ring-sand-500/30",
};

function blankDraft(defaultGroup: string): Draft {
  return {
    slug: "",
    commonName: "",
    localName: "",
    scientificName: "",
    group: defaultGroup,
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "",
    description: "",
    photoSrc: "",
  };
}

function draftFrom(entry: Species): Draft {
  return {
    slug: entry.slug,
    commonName: entry.commonName,
    localName: entry.localName ?? "",
    scientificName: entry.scientificName,
    group: entry.group,
    status: entry.status,
    seasonality: entry.seasonality,
    habitat: entry.habitat,
    description: entry.description,
    photoSrc: entry.photo?.src ?? "",
  };
}

export default function SpeciesManager({
  published,
  archived,
  groups,
  photoLibrary,
}: {
  published: Species[];
  archived: Species[];
  groups: WildlifeGroup[];
  photoLibrary: PhotoOption[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const groupNames = useMemo(
    () => new Map(groups.map((item) => [item.slug, item.shortName])),
    [groups],
  );

  const filteredPublished = useMemo(() => {
    const q = query.trim().toLowerCase();
    return published.filter((entry) => {
      if (groupFilter !== "all" && entry.group !== groupFilter) return false;
      if (!q) return true;
      return (
        entry.commonName.toLowerCase().includes(q) ||
        (entry.localName?.toLowerCase().includes(q) ?? false) ||
        entry.scientificName.toLowerCase().includes(q) ||
        entry.habitat.toLowerCase().includes(q)
      );
    });
  }, [published, groupFilter, query]);

  function openCreate() {
    setNotice(null);
    setDraft(blankDraft(groups[0]?.slug ?? "waterbirds"));
  }

  function openEdit(entry: Species) {
    setNotice(null);
    setDraft(draftFrom(entry));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveSpeciesAction(formData);
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
      const result = await setSpeciesArchivedAction(slug, next);
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
          aria-labelledby="species-editor-heading"
          className="rounded-2xl bg-white ring-1 ring-ink/8"
        >
          <div className="flex items-center justify-between gap-4 border-b border-ink/8 px-5 py-4">
            <div>
              <h2
                id="species-editor-heading"
                className="font-display text-[19px] leading-tight text-ink"
              >
                {draft.slug ? `Edit ${draft.commonName}` : "Add wildlife species"}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                {draft.slug
                  ? "Changes appear on /wildlife and its species record page immediately."
                  : "Adds a documented species card to the public wildlife catalogue."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-full p-1.5 text-ink-soft/60 transition hover:bg-sand-100 hover:text-ink"
              aria-label="Close editor"
            >
              <X className="size-4" strokeWidth={2.2} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
            <input type="hidden" name="slug" value={draft.slug} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="sp-common" className={labelClass}>
                  Common name
                </label>
                <input
                  id="sp-common"
                  name="commonName"
                  required
                  value={draft.commonName}
                  onChange={(e) => setDraft({ ...draft, commonName: e.target.value })}
                  placeholder="Philippine duck"
                  className={`${fieldClass} mt-1.5`}
                />
              </div>

              <div>
                <label htmlFor="sp-local" className={labelClass}>
                  Local / Tagalog name
                </label>
                <input
                  id="sp-local"
                  name="localName"
                  value={draft.localName}
                  onChange={(e) => setDraft({ ...draft, localName: e.target.value })}
                  placeholder="Pato del monte (optional)"
                  className={`${fieldClass} mt-1.5`}
                />
              </div>

              <div>
                <label htmlFor="sp-scientific" className={labelClass}>
                  Scientific name
                </label>
                <input
                  id="sp-scientific"
                  name="scientificName"
                  required
                  value={draft.scientificName}
                  onChange={(e) =>
                    setDraft({ ...draft, scientificName: e.target.value })
                  }
                  placeholder="Anas luzonica"
                  className={`${fieldClass} mt-1.5 italic`}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="sp-group" className={labelClass}>
                  Taxonomic group
                </label>
                <select
                  id="sp-group"
                  name="group"
                  value={draft.group}
                  onChange={(e) => setDraft({ ...draft, group: e.target.value })}
                  className={`${fieldClass} mt-1.5`}
                >
                  {groups.map((group) => (
                    <option key={group.slug} value={group.slug}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sp-status" className={labelClass}>
                  IUCN conservation status
                </label>
                <select
                  id="sp-status"
                  name="status"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value as ConservationStatus,
                    })
                  }
                  className={`${fieldClass} mt-1.5`}
                >
                  {conservationStatuses.map((code) => (
                    <option key={code} value={code}>
                      {code} — {conservationLabels[code]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sp-seasonality" className={labelClass}>
                  Presence / Seasonality
                </label>
                <select
                  id="sp-seasonality"
                  name="seasonality"
                  value={draft.seasonality}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      seasonality: e.target.value as Seasonality,
                    })
                  }
                  className={`${fieldClass} mt-1.5`}
                >
                  {seasonalities.map((season) => (
                    <option key={season} value={season}>
                      {seasonalityLabels[season]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor="sp-habitat" className={labelClass}>
                  Habitat on the lake
                </label>
                <input
                  id="sp-habitat"
                  name="habitat"
                  required
                  value={draft.habitat}
                  onChange={(e) => setDraft({ ...draft, habitat: e.target.value })}
                  placeholder="Shallow emergent reed beds and sheltered eastern bays"
                  className={`${fieldClass} mt-1.5`}
                />
              </div>

              <div>
                <label htmlFor="sp-photo" className={labelClass}>
                  Reference photograph
                </label>
                <div className="mt-1.5 flex items-center gap-3">
                  <select
                    id="sp-photo"
                    name="photoSrc"
                    value={draft.photoSrc}
                    onChange={(e) =>
                      setDraft({ ...draft, photoSrc: e.target.value })
                    }
                    className={fieldClass}
                  >
                    <option value="">No photo (show taxonomy icon)</option>
                    {photoLibrary.map((photo) => (
                      <option key={photo.slug} value={photo.src}>
                        {photo.label} — Photo: {photo.credit}
                      </option>
                    ))}
                  </select>
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-sand-100 ring-1 ring-ink/10">
                    {draft.photoSrc ? (
                      <Image
                        src={draft.photoSrc}
                        alt="Selected species preview"
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-sand-500">
                        <ImageIcon className="size-4" strokeWidth={1.8} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="sp-description" className={labelClass}>
                Field description
              </label>
              <textarea
                id="sp-description"
                name="description"
                required
                rows={4}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="Key field marks, typical flock behavior, and where accredited boat guides look for it."
                className={`${fieldClass} mt-1.5`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink/8 pt-4">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-full px-4 py-2 text-[12.5px] font-medium text-ink-soft/75 transition hover:bg-sand-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-2 text-[12.5px] font-semibold text-sand-50 transition hover:bg-lake-700 disabled:opacity-60"
              >
                {pending
                  ? "Saving..."
                  : draft.slug
                    ? "Save species changes"
                    : "Publish species"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section
        aria-labelledby="species-catalogue-heading"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/8 px-5 py-4">
          <div>
            <h2
              id="species-catalogue-heading"
              className="font-display text-[19px] leading-tight text-ink"
            >
              Published species ({filteredPublished.length})
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Live entries displayed in /wildlife and individual species sheets
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-lake-800 px-4 py-2 text-[12.5px] font-semibold text-sand-50 transition hover:bg-lake-700"
          >
            <Plus className="size-3.5" strokeWidth={2.4} />
            Add species
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 bg-sand-50/60 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setGroupFilter("all")}
              className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition ${
                groupFilter === "all"
                  ? "bg-lake-800 text-sand-50"
                  : "bg-white text-ink-soft/75 ring-1 ring-ink/10 hover:text-ink"
              }`}
            >
              All ({published.length})
            </button>
            {groups.map((group) => (
              <button
                key={group.slug}
                type="button"
                onClick={() => setGroupFilter(group.slug)}
                className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition ${
                  groupFilter === group.slug
                    ? "bg-lake-800 text-sand-50"
                    : "bg-white text-ink-soft/75 ring-1 ring-ink/10 hover:text-ink"
                }`}
              >
                {group.shortName}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-sand-500"
              strokeWidth={2}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or habitat..."
              className="w-full rounded-full bg-white py-1.5 pr-3 pl-8 text-[12.5px] text-ink ring-1 ring-ink/10 outline-none focus:ring-2 focus:ring-lake-600/40"
            />
          </div>
        </div>

        <ul className="divide-y divide-ink/6">
          {filteredPublished.map((entry) => (
            <li
              key={entry.slug}
              className="flex flex-wrap items-start gap-4 px-5 py-4 transition-colors hover:bg-sand-50/70"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-sand-100 ring-1 ring-ink/10">
                {entry.photo ? (
                  <Image
                    src={entry.photo.src}
                    alt={entry.commonName}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-lake-800/70">
                    <Bird className="size-5" strokeWidth={1.7} />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-medium text-ink">
                    {entry.commonName}
                  </p>
                  {entry.localName ? (
                    <span className="text-[12px] text-sand-600">
                      · {entry.localName}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset ${statusChip[entry.status]}`}
                  >
                    {entry.status} · {conservationLabels[entry.status]}
                  </span>
                  <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-ink-soft/75">
                    {groupNames.get(entry.group) ?? entry.group}
                  </span>
                </div>

                <p className="mt-0.5 text-[12px] text-ink-soft/65 italic">
                  {entry.scientificName}
                </p>

                <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft/75">
                  {entry.description}
                </p>

                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-soft/55">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" strokeWidth={2.1} />
                    {entry.habitat}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3" strokeWidth={2.1} />
                    {seasonalityLabels[entry.seasonality]}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(entry)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink-soft/75 transition hover:bg-sand-100 hover:text-ink"
                >
                  <PencilLine className="size-3.5" strokeWidth={2.2} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleArchived(entry.slug, true)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink-soft/75 transition hover:bg-alert-50 hover:text-alert-700 disabled:opacity-50"
                >
                  <Archive className="size-3.5" strokeWidth={2.2} />
                  Archive
                </button>
                <a
                  href={`/wildlife/${entry.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full p-1.5 text-ink-soft/50 transition hover:bg-sand-100 hover:text-ink"
                  aria-label={`View ${entry.commonName} on the public site`}
                >
                  <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
                </a>
              </div>
            </li>
          ))}
        </ul>

        {filteredPublished.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-soft/60">
            No species match your current filter.
          </p>
        ) : null}
      </section>

      {archived.length > 0 ? (
        <section
          aria-labelledby="species-archived-heading"
          className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
        >
          <div className="border-b border-ink/8 px-5 py-4">
            <h2
              id="species-archived-heading"
              className="font-display text-[19px] leading-tight text-ink"
            >
              Archived ({archived.length})
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Hidden from /wildlife, preserved so records can be restored anytime
            </p>
          </div>

          <ul className="divide-y divide-ink/6">
            {archived.map((entry) => (
              <li
                key={entry.slug}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">
                    {entry.commonName}{" "}
                    <span className="font-normal text-ink-soft/60 italic">
                      ({entry.scientificName})
                    </span>
                  </p>
                  <p className="text-[11.5px] text-ink-soft/55">
                    {groupNames.get(entry.group) ?? entry.group} ·{" "}
                    {conservationLabels[entry.status]}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleArchived(entry.slug, false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3.5 py-1.5 text-[11.5px] font-medium text-ink transition hover:bg-moss-50 hover:text-moss-800 disabled:opacity-50"
                >
                  <RotateCcw className="size-3.5" strokeWidth={2.2} />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
