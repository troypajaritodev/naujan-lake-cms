"use client";

import { useMemo, useState, useTransition } from "react";
import { Megaphone, Pencil, Pin, Plus, X } from "lucide-react";
import {
  saveAdminAdvisoryAction,
  setAdminAdvisoryBannerAction,
  setAdminAdvisoryPublishedAction,
  type AdminAdvisory,
} from "@/lib/admin-advisory-actions";

const severities = ["INFO", "WARNING", "CRITICAL"] as const;
const fieldClass = "w-full rounded-xl border-0 bg-sand-50 px-3.5 py-2.5 text-[13.5px] text-ink ring-1 ring-ink/10 ring-inset outline-none focus:bg-white focus:ring-2 focus:ring-lake-600/40";

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AdvisoryManager({ initialAdvisories }: { initialAdvisories: AdminAdvisory[] }) {
  const [advisories, setAdvisories] = useState(initialAdvisories);
  const [editing, setEditing] = useState<AdminAdvisory | null | "new">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const published = useMemo(() => advisories.filter((item) => item.isPublished), [advisories]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveAdminAdvisoryAction(data);
      if (!result.ok) { setError(result.message); return; }
      setAdvisories((current) => [result.advisory, ...current.filter((item) => item.id !== result.advisory.id)]);
      setEditing(null); setError(null); setNotice(result.message);
    });
  }

  function updateLocal(advisory: AdminAdvisory) {
    setAdvisories((current) => current.map((item) => item.id === advisory.id ? advisory : item));
  }

  function togglePublished(advisory: AdminAdvisory) {
    startTransition(async () => {
      const result = await setAdminAdvisoryPublishedAction(advisory.id, !advisory.isPublished);
      if (result.ok) { updateLocal(result.advisory); setNotice(result.message); setError(null); }
      else setError(result.message);
    });
  }

  function toggleBanner(advisory: AdminAdvisory) {
    startTransition(async () => {
      const result = await setAdminAdvisoryBannerAction(advisory.id, !advisory.isActiveBanner);
      if (result.ok) {
        setAdvisories((current) => current.map((item) => ({ ...item, isActiveBanner: item.id === result.advisory.id ? result.advisory.isActiveBanner : false })));
        setNotice(result.message); setError(null);
      } else setError(result.message);
    });
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">Supabase records</p><h2 className="mt-1 font-display text-[22px] text-ink">Advisories</h2><p className="mt-1 text-[12px] text-ink-soft/70">{published.length} published · {advisories.length} total</p></div>
      <button type="button" onClick={() => { setEditing("new"); setNotice(null); setError(null); }} className="inline-flex items-center gap-2 rounded-full bg-lake-900 px-4 py-2.5 text-[12px] font-semibold text-white"><Plus className="size-3.5" />New advisory</button>
    </div>
    {(notice || error) && <div role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-[13px] ${error ? "bg-alert-50 text-alert-700" : "bg-moss-50 text-moss-800"}`}>{error ?? notice}<button type="button" onClick={() => { setError(null); setNotice(null); }} className="float-right" aria-label="Dismiss message"><X className="size-4" /></button></div>}
    {editing && <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-ink/8">
      <div className="flex items-center justify-between"><h3 className="font-display text-[19px]">{editing === "new" ? "New advisory" : "Edit advisory"}</h3><button type="button" onClick={() => setEditing(null)} aria-label="Close editor"><X className="size-4" /></button></div>
      {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}
      <input type="hidden" name="slug" value={editing === "new" ? "" : editing.slug} />
      <label className="block text-[11px] font-semibold uppercase text-sand-700">Headline<input name="title" required maxLength={120} defaultValue={editing === "new" ? "" : editing.title} className={`mt-1.5 ${fieldClass}`} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-[11px] font-semibold uppercase text-sand-700">Severity<select name="severity" defaultValue={editing === "new" ? "INFO" : editing.severity} className={`mt-1.5 ${fieldClass}`}>{severities.map((value) => <option key={value}>{value}</option>)}</select></label><label className="block text-[11px] font-semibold uppercase text-sand-700">Published date<input name="publishedAt" type="date" required defaultValue={editing === "new" ? today() : editing.publishedAt} className={`mt-1.5 ${fieldClass}`} /></label></div>
      <label className="block text-[11px] font-semibold uppercase text-sand-700">Summary<textarea name="excerpt" required maxLength={320} defaultValue={editing === "new" ? "" : editing.excerpt} className={`mt-1.5 ${fieldClass}`} rows={2} /></label>
      <label className="block text-[11px] font-semibold uppercase text-sand-700">Content<textarea name="content" required defaultValue={editing === "new" ? "" : editing.body.join("\n\n")} className={`mt-1.5 ${fieldClass}`} rows={7} /></label>
      <label className="flex items-center gap-2 text-[12px] text-ink"><input type="checkbox" name="isActiveBanner" defaultChecked={editing !== "new" && editing.isActiveBanner} /> Pin this advisory to the site banner</label>
      <button type="submit" disabled={pending} className="rounded-full bg-lake-900 px-5 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save advisory"}</button>
    </form>}
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"><div className="divide-y divide-ink/6">{advisories.map((advisory) => <article key={advisory.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><div className="flex items-center gap-2"><Megaphone className="size-4 text-lake-700" /><h3 className="text-[14px] font-semibold text-ink">{advisory.title}</h3>{advisory.isActiveBanner && <Pin className="size-3.5 text-reed-600" />}</div><p className="mt-1 text-[12px] text-ink-soft/70">{advisory.severity} · {advisory.isPublished ? "Published" : "Unpublished"} · {advisory.slug}</p><p className="mt-2 max-w-2xl text-[12.5px] text-ink-soft/80">{advisory.excerpt}</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => setEditing(advisory)} aria-label={`Edit ${advisory.title}`} className="rounded-lg p-2 text-lake-900 hover:bg-lake-50"><Pencil className="size-4" /></button><button type="button" disabled={pending} onClick={() => togglePublished(advisory)} className="rounded-lg px-3 py-2 text-[11px] font-medium text-lake-900 hover:bg-lake-50">{advisory.isPublished ? "Unpublish" : "Publish"}</button><button type="button" disabled={pending} onClick={() => toggleBanner(advisory)} className="rounded-lg px-3 py-2 text-[11px] font-medium text-lake-900 hover:bg-lake-50">{advisory.isActiveBanner ? "Unpin" : "Pin"}</button></div></article>)}{advisories.length === 0 && <p className="p-10 text-center text-[13px] text-ink-soft/70">No advisories in Supabase yet.</p>}</div></section>
  </div>;
}
