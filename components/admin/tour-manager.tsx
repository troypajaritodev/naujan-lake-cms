"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Map,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import TourEditorDialog from "@/components/admin/tour-editor-dialog";
import {
  listAdminTourSpeciesAction,
  listAdminToursAction,
  saveAdminTourAction,
  setAdminTourActiveAction,
} from "@/lib/admin-tour-actions";
import type {
  TourAdminInput,
  TourAdminRecord,
  TourSpeciesOption,
} from "@/lib/tour-validation";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

function sortTours(tours: TourAdminRecord[]) {
  return [...tours].sort((a, b) => a.title.localeCompare(b.title));
}

export default function TourManager() {
  const [tours, setTours] = useState<TourAdminRecord[]>([]);
  const [species, setSpecies] = useState<TourSpeciesOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTour, setEditingTour] = useState<TourAdminRecord | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const [tourRows, speciesRows] = await Promise.all([
        listAdminToursAction(),
        listAdminTourSpeciesAction(),
      ]);
      setTours(sortTours(tourRows));
      setSpecies(speciesRows);
    } catch (cause) {
      setLoadError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([listAdminToursAction(), listAdminTourSpeciesAction()])
      .then(([tourRows, speciesRows]) => {
        if (!active) return;
        setTours(sortTours(tourRows));
        setSpecies(speciesRows);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => [...new Set(tours.map((tour) => tour.category.trim()).filter(Boolean))].sort(),
    [tours],
  );
  const durations = useMemo(
    () => [...new Set(tours.map((tour) => tour.duration.trim()).filter(Boolean))].sort(),
    [tours],
  );
  const departures = useMemo(
    () => [...new Set(tours.map((tour) => tour.departure.trim()).filter(Boolean))].sort(),
    [tours],
  );

  function openCreate() {
    setEditingTour(null);
    setError(null);
    setNotice(null);
    setEditorOpen(true);
  }

  function openEdit(tour: TourAdminRecord) {
    setEditingTour(tour);
    setError(null);
    setNotice(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingTour(null);
  }

  async function saveTour(input: TourAdminInput) {
    setError(null);
    setRefreshError(null);
    const saved = await saveAdminTourAction(input);
    setTours((current) =>
      sortTours([...current.filter((tour) => tour.id !== saved.id), saved]),
    );
    setNotice(`${saved.title} ${input.id ? "updated" : "created"}.`);

    try {
      setTours(sortTours(await listAdminToursAction()));
    } catch (cause) {
      setRefreshError(
        `The tour was saved, but the list could not be refreshed: ${errorMessage(cause)}`,
      );
    }
  }

  async function toggleActive(tour: TourAdminRecord) {
    const nextActive = !tour.isActive;
    setBusyId(tour.id);
    setError(null);
    setNotice(null);
    setRefreshError(null);
    try {
      await setAdminTourActiveAction(tour.id, nextActive);
      setTours((current) =>
        current.map((entry) =>
          entry.id === tour.id ? { ...entry, isActive: nextActive } : entry,
        ),
      );
      setNotice(`${tour.title} ${nextActive ? "activated" : "deactivated"}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-white p-8 text-sm text-sand-700 ring-1 ring-ink/8">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading tour packages from Supabase…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-alert-500/20">
        <p role="alert" className="text-[13px] text-alert-700">
          Could not load the tour CMS data: {loadError}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-4 rounded-full bg-lake-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-lake-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lake-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-alert-500/15 bg-alert-50 px-4 py-3 text-[12.5px] text-alert-700"
        >
          {error}
        </p>
      )}
      {refreshError && (
        <p
          role="alert"
          className="rounded-xl border border-alert-500/15 bg-alert-50 px-4 py-3 text-[12.5px] text-alert-700"
        >
          {refreshError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-moss-500/15 bg-moss-50 px-4 py-3 text-[12.5px] text-moss-700"
        >
          {notice}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/8 px-5 py-5 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              Supabase records
            </p>
            <h2 className="mt-1 font-display text-[22px] text-ink">
              Tour packages
            </h2>
            <p className="mt-1 text-[12px] text-ink-soft/70">
              {tours.length} package{tours.length === 1 ? "" : "s"} · includes
              inactive tours
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={busyId !== null}
            className="inline-flex items-center gap-2 rounded-full bg-lake-900 px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-lake-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lake-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add tour
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-ink/8 bg-sand-50/70 text-[10px] font-semibold tracking-[0.12em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-3.5">Package</th>
                <th scope="col" className="px-5 py-3.5">Category</th>
                <th scope="col" className="px-5 py-3.5">Rate / capacity</th>
                <th scope="col" className="px-5 py-3.5">Status</th>
                <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {tours.map((tour) => (
                <tr key={tour.id} className="transition-colors hover:bg-sand-50/70">
                  <td className="px-5 py-4">
                    <p className="text-[13px] font-semibold text-ink">{tour.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft/65">
                      {tour.duration} · {tour.departure}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-[12px] text-ink-soft/80">
                    {tour.category}
                  </td>
                  <td className="px-5 py-4 text-[12px] text-ink-soft/80">
                    ₱{tour.ratePerPerson.toLocaleString("en-PH")} · {tour.maxCapacity} guests
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
                        tour.isActive
                          ? "bg-moss-50 text-moss-700"
                          : "bg-sand-100 text-sand-700"
                      }`}
                    >
                      {tour.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(tour)}
                        disabled={busyId !== null}
                        aria-label={`Edit ${tour.title}`}
                        className="grid size-9 place-items-center rounded-lg text-lake-900 hover:bg-lake-50 focus-visible:outline-2 focus-visible:outline-lake-700 disabled:opacity-50"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(tour)}
                        disabled={busyId !== null}
                        aria-label={`${tour.isActive ? "Deactivate" : "Reactivate"} ${tour.title}`}
                        className="inline-flex min-w-24 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium text-lake-900 hover:bg-lake-50 focus-visible:outline-2 focus-visible:outline-lake-700 disabled:opacity-50"
                      >
                        {busyId === tour.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : tour.isActive ? (
                          <ToggleLeft className="size-4" aria-hidden="true" />
                        ) : (
                          <ToggleRight className="size-4" aria-hidden="true" />
                        )}
                        {tour.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tours.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <Map className="mx-auto size-7 text-sand-400" aria-hidden="true" />
                    <p className="mt-3 text-[13px] font-medium text-ink">
                      No tour packages in Supabase yet.
                    </p>
                    <p className="mt-1 text-[12px] text-ink-soft/65">
                      Create a package to add it to the database.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editorOpen && (
        <TourEditorDialog
          key={editingTour?.id ?? "new-tour"}
          tour={editingTour}
          categories={categories}
          durations={durations}
          departures={departures}
          species={species}
          onClose={closeEditor}
          onSave={saveTour}
        />
      )}
    </div>
  );
}
