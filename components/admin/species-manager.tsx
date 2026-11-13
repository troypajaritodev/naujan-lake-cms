"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  deleteAdminSpeciesAction,
  listAdminSpeciesAction,
  saveAdminSpeciesAction,
  type SpeciesAdminInput,
} from "@/lib/admin-species-actions";
import {
  conservationLabels,
  conservationStatuses,
  seasonalities,
  seasonalityLabels,
  type Species,
  type WildlifeGroup,
} from "@/lib/species-meta";

const EMPTY_INPUT: SpeciesAdminInput = {
  slug: "",
  group: "",
  commonName: "",
  localName: "",
  scientificName: "",
  status: "LC",
  seasonality: "RESIDENT",
  habitat: "",
  description: "",
  featuredImage: "/images/shoreline.jpg",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export default function SpeciesManager() {
  const [groups, setGroups] = useState<WildlifeGroup[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [input, setInput] = useState<SpeciesAdminInput>(EMPTY_INPUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listAdminSpeciesAction()
      .then((result) => {
        if (!active) return;
        setGroups(result.groups);
        setSpecies(result.species);
        setInput((current) => ({
          ...current,
          group: result.groups[0]?.slug ?? "",
        }));
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function startCreate() {
    setInput({ ...EMPTY_INPUT, group: groups[0]?.slug ?? "" });
    setEditing(false);
    setError(null);
    setNotice(null);
  }

  function startEdit(entry: Species) {
    setInput({
      id: entry.id,
      slug: entry.slug,
      group: entry.group,
      commonName: entry.commonName,
      localName: entry.localName ?? "",
      scientificName: entry.scientificName,
      status: entry.status,
      seasonality: entry.seasonality,
      habitat: entry.habitat,
      description: entry.description,
      featuredImage: entry.featuredImage ?? "/images/shoreline.jpg",
    });
    setEditing(true);
    setError(null);
    setNotice(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveAdminSpeciesAction(input);
      setSpecies((current) =>
        [...current.filter((entry) => entry.id !== saved.id), saved].sort(
          (a, b) => a.commonName.localeCompare(b.commonName),
        ),
      );
      setInput({ ...EMPTY_INPUT, group: groups[0]?.slug ?? "" });
      setEditing(false);
      setNotice(`${saved.commonName} saved.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: Species) {
    if (!entry.id || !window.confirm(`Delete ${entry.commonName}? This cannot be undone.`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteAdminSpeciesAction(entry.id);
      setSpecies((current) => current.filter((item) => item.id !== entry.id));
      if (input.id === entry.id) startCreate();
      setNotice(`${entry.commonName} deleted.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof SpeciesAdminInput>(
    key: K,
    value: SpeciesAdminInput[K],
  ) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-white p-8 text-sm text-sand-700 ring-1 ring-ink/8">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading wildlife records…
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-ink">Species records</h2>
            <p className="mt-1 text-[12.5px] text-ink-soft/70">
              {species.length} record{species.length === 1 ? "" : "s"} · Supabase
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-full bg-lake-800 px-4 py-2 text-[12px] font-semibold text-white hover:bg-lake-700"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add species
          </button>
        </div>

        {error && (
          <p role="alert" className="border-b border-alert-500/15 bg-alert-50 px-5 py-3 text-[12.5px] text-alert-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="border-b border-moss-500/15 bg-moss-50 px-5 py-3 text-[12.5px] text-moss-700">
            {notice}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.12em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-3">Species</th>
                <th scope="col" className="px-5 py-3">Group</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {species.map((entry) => (
                <tr key={entry.id ?? entry.slug} className="hover:bg-sand-50/70">
                  <td className="px-5 py-3.5">
                    <p className="text-[13px] font-medium text-ink">{entry.commonName}</p>
                    <p className="mt-0.5 text-[11px] italic text-ink-soft/65">{entry.scientificName}</p>
                  </td>
                  <td className="px-5 py-3.5 text-[12px] text-ink-soft/80">
                    {groups.find((group) => group.slug === entry.group)?.shortName ?? entry.group}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-ink-soft/80">{entry.status}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        aria-label={`Edit ${entry.commonName}`}
                        className="grid size-8 place-items-center rounded-lg text-lake-800 hover:bg-lake-50"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(entry)}
                        disabled={saving}
                        aria-label={`Delete ${entry.commonName}`}
                        className="grid size-8 place-items-center rounded-lg text-alert-700 hover:bg-alert-50 disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {species.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-[13px] text-ink-soft/65">
                    No species records yet. Add a record or run the species seed script.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <form onSubmit={save} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-ink/8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink">
              {editing ? "Edit species" : "New species"}
            </h2>
            <p className="mt-1 text-[12px] text-ink-soft/65">
              Fields marked required are stored in the catalogue.
            </p>
          </div>
          {editing && (
            <button type="button" onClick={startCreate} aria-label="Cancel editing" className="grid size-8 place-items-center rounded-lg text-sand-600 hover:bg-sand-100">
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <label className="block text-[11.5px] font-medium text-ink">
          Common name *
          <input required value={input.commonName} onChange={(event) => update("commonName", event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 text-[13px] outline-none focus:border-lake-700" />
        </label>
        <label className="block text-[11.5px] font-medium text-ink">
          Slug *
          <input required value={input.slug} onChange={(event) => update("slug", event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 font-mono text-[12px] outline-none focus:border-lake-700" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[11.5px] font-medium text-ink">
            Scientific name *
            <input required value={input.scientificName} onChange={(event) => update("scientificName", event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 text-[13px] outline-none focus:border-lake-700" />
          </label>
          <label className="block text-[11.5px] font-medium text-ink">
            Local name
            <input value={input.localName} onChange={(event) => update("localName", event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 text-[13px] outline-none focus:border-lake-700" />
          </label>
        </div>
        <label className="block text-[11.5px] font-medium text-ink">
          Wildlife group *
          <select required value={input.group} onChange={(event) => update("group", event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 text-[13px] outline-none focus:border-lake-700">
            <option value="" disabled>Select a group</option>
            {groups.map((group) => <option key={group.id} value={group.slug}>{group.name}</option>)}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[11.5px] font-medium text-ink">
            Conservation status *
            <select value={input.status} onChange={(event) => update("status", event.target.value as Species["status"])} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 text-[13px] outline-none focus:border-lake-700">
              {conservationStatuses.map((status) => <option key={status} value={status}>{status} · {conservationLabels[status]}</option>)}
            </select>
          </label>
          <label className="block text-[11.5px] font-medium text-ink">
            Seasonality *
            <select value={input.seasonality} onChange={(event) => update("seasonality", event.target.value as Species["seasonality"])} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 text-[13px] outline-none focus:border-lake-700">
              {seasonalities.map((season) => <option key={season} value={season}>{seasonalityLabels[season]}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-[11.5px] font-medium text-ink">
          Habitat *
          <input required value={input.habitat} onChange={(event) => update("habitat", event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 text-[13px] outline-none focus:border-lake-700" />
        </label>
        <label className="block text-[11.5px] font-medium text-ink">
          Description *
          <textarea required rows={4} value={input.description} onChange={(event) => update("description", event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-ink/15 bg-sand-50 px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-lake-700" />
        </label>
        <label className="block text-[11.5px] font-medium text-ink">
          Featured image path or HTTPS URL *
          <span className="mt-1.5 flex items-center gap-2 rounded-lg border border-ink/15 bg-sand-50 px-3">
            <ImagePlus className="size-4 shrink-0 text-sand-500" aria-hidden="true" />
            <input required value={input.featuredImage} onChange={(event) => update("featuredImage", event.target.value)} className="w-full bg-transparent py-2.5 text-[12px] outline-none" />
          </span>
        </label>
        <button type="submit" disabled={saving || groups.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-lake-800 px-4 py-3 text-[12.5px] font-semibold text-white hover:bg-lake-700 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {saving ? "Saving…" : editing ? "Save changes" : "Create species"}
        </button>
      </form>
    </div>
  );
}
