"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CameraOff,
  Check,
  Fish,
  Footprints,
  LifeBuoy,
  PencilLine,
  Plus,
  RotateCcw,
  Route,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteParkRuleAction,
  moveParkRuleAction,
  resetGuidelinesAction,
  saveLakeZoneAction,
  saveParkRuleAction,
} from "@/app/admin/rules/actions";
import type { ParkRule, Zone, ZoneTone } from "@/lib/guidelines";

type RuleDraft = {
  index: number | null;
  icon: ParkRule["icon"];
  title: string;
  body: string;
  note: string;
};

type ZoneDraft = {
  id: string;
  name: string;
  access: string;
  summary: string;
  share: string;
  allowed: string;
  restricted: string;
};

type Notice = { tone: "ok" | "error"; text: string };

const ruleIcons: Record<ParkRule["icon"], typeof Trash2> = {
  litter: Trash2,
  camera: CameraOff,
  fish: Fish,
  lifejacket: LifeBuoy,
  route: Route,
  collect: Footprints,
};

const ruleIconLabels: { value: ParkRule["icon"]; label: string }[] = [
  { value: "litter", label: "Waste / Leave no trace" },
  { value: "camera", label: "Camera / Nesting" },
  { value: "fish", label: "Fishing / Catch limits" },
  { value: "lifejacket", label: "Safety / Life jackets" },
  { value: "route", label: "Routes / Navigation" },
  { value: "collect", label: "Access / Flora & Fauna" },
];

const zoneTones: Record<
  ZoneTone,
  { bar: string; accent: string; badge: string; dot: string }
> = {
  core: {
    bar: "bg-lake-800",
    accent: "bg-lake-800",
    badge: "bg-lake-50 text-lake-800 ring-lake-700/20",
    dot: "bg-lake-800",
  },
  use: {
    bar: "bg-lake-400",
    accent: "bg-lake-400",
    badge: "bg-lake-50 text-lake-700 ring-lake-500/25",
    dot: "bg-lake-400",
  },
  buffer: {
    bar: "bg-sand-400",
    accent: "bg-sand-400",
    badge: "bg-sand-100 text-sand-800 ring-sand-500/25",
    dot: "bg-sand-400",
  },
};

const fieldClass =
  "w-full rounded-xl border-0 bg-sand-50 px-3.5 py-2.5 text-[13.5px] text-ink ring-1 ring-ink/10 ring-inset outline-none transition focus:bg-white focus:ring-2 focus:ring-lake-600/40";

const labelClass =
  "block text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase";

export default function RulesManager({
  rules,
  zones,
  rulesCustomized,
  zonesCustomized,
}: {
  rules: ParkRule[];
  zones: Zone[];
  rulesCustomized: boolean;
  zonesCustomized: boolean;
}) {
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();

  function openNewRule() {
    setNotice(null);
    setZoneDraft(null);
    setRuleDraft({
      index: null,
      icon: "route",
      title: "",
      body: "",
      note: "",
    });
  }

  function openEditRule(rule: ParkRule, index: number) {
    setNotice(null);
    setZoneDraft(null);
    setRuleDraft({
      index,
      icon: rule.icon,
      title: rule.title,
      body: rule.body,
      note: rule.note ?? "",
    });
  }

  function openEditZone(zone: Zone) {
    setNotice(null);
    setRuleDraft(null);
    setZoneDraft({
      id: zone.id,
      name: zone.name,
      access: zone.access,
      summary: zone.summary,
      share: zone.share.replace("%", ""),
      allowed: zone.allowed.join("\n"),
      restricted: zone.restricted.join("\n"),
    });
  }

  function submitRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveParkRuleAction(formData);
      if (result.ok) {
        setRuleDraft(null);
        setNotice({ tone: "ok", text: result.message });
      } else {
        setNotice({ tone: "error", text: result.message });
      }
    });
  }

  function submitZone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveLakeZoneAction(formData);
      if (result.ok) {
        setZoneDraft(null);
        setNotice({ tone: "ok", text: result.message });
      } else {
        setNotice({ tone: "error", text: result.message });
      }
    });
  }

  function deleteRule(index: number) {
    startTransition(async () => {
      const result = await deleteParkRuleAction(index);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    });
  }

  function moveRule(index: number, direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveParkRuleAction(index, direction);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    });
  }

  function resetSection(scope: "rules" | "zones") {
    startTransition(async () => {
      const result = await resetGuidelinesAction(scope);
      if (scope === "rules") setRuleDraft(null);
      if (scope === "zones") setZoneDraft(null);
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

      {ruleDraft ? (
        <section
          aria-labelledby="rule-editor-heading"
          className="rounded-2xl bg-white ring-1 ring-ink/8"
        >
          <div className="flex items-center justify-between gap-4 border-b border-ink/8 px-5 py-4">
            <div>
              <h2
                id="rule-editor-heading"
                className="font-display text-[19px] leading-tight text-ink"
              >
                {ruleDraft.index === null
                  ? "Add park rule"
                  : `Edit rule #${ruleDraft.index + 1}`}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                Published immediately on the public guidelines page
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRuleDraft(null)}
              className="rounded-full p-1.5 text-ink-soft/60 transition hover:bg-sand-100 hover:text-ink"
              aria-label="Close rule editor"
            >
              <X className="size-4" strokeWidth={2.2} />
            </button>
          </div>

          <form onSubmit={submitRule} className="space-y-4 p-5 sm:p-6">
            <input
              type="hidden"
              name="index"
              value={ruleDraft.index === null ? "" : String(ruleDraft.index)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rule-title" className={labelClass}>
                  Rule title
                </label>
                <input
                  id="rule-title"
                  name="title"
                  required
                  value={ruleDraft.title}
                  onChange={(e) =>
                    setRuleDraft({ ...ruleDraft, title: e.target.value })
                  }
                  placeholder="Leave no trace"
                  className={`${fieldClass} mt-1.5`}
                />
              </div>

              <div>
                <label htmlFor="rule-icon" className={labelClass}>
                  Icon
                </label>
                <select
                  id="rule-icon"
                  name="icon"
                  value={ruleDraft.icon}
                  onChange={(e) =>
                    setRuleDraft({
                      ...ruleDraft,
                      icon: e.target.value as ParkRule["icon"],
                    })
                  }
                  className={`${fieldClass} mt-1.5`}
                >
                  {ruleIconLabels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="rule-body" className={labelClass}>
                Visitor guidance
              </label>
              <textarea
                id="rule-body"
                name="body"
                required
                rows={3}
                value={ruleDraft.body}
                onChange={(e) =>
                  setRuleDraft({ ...ruleDraft, body: e.target.value })
                }
                placeholder="Keep this short enough to scan on a phone at the boat dock."
                className={`${fieldClass} mt-1.5`}
              />
            </div>

            <div>
              <label htmlFor="rule-note" className={labelClass}>
                Footer / dock note (optional)
              </label>
              <input
                id="rule-note"
                name="note"
                value={ruleDraft.note}
                onChange={(e) =>
                  setRuleDraft({ ...ruleDraft, note: e.target.value })
                }
                placeholder="Single-use plastic is discouraged at all access points."
                className={`${fieldClass} mt-1.5`}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-ink/8 pt-4">
              <button
                type="button"
                onClick={() => setRuleDraft(null)}
                className="rounded-full px-4 py-2 text-[12.5px] font-medium text-ink-soft/75 transition hover:bg-sand-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-lake-800 px-5 py-2 text-[12.5px] font-semibold text-sand-50 transition hover:bg-lake-700 disabled:opacity-60"
              >
                {pending
                  ? "Saving..."
                  : ruleDraft.index === null
                    ? "Add rule"
                    : "Save rule"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {zoneDraft ? (
        <section
          aria-labelledby="zone-editor-heading"
          className="rounded-2xl bg-white ring-1 ring-ink/8"
        >
          <div className="flex items-center justify-between gap-4 border-b border-ink/8 px-5 py-4">
            <div>
              <h2
                id="zone-editor-heading"
                className="font-display text-[19px] leading-tight text-ink"
              >
                Edit {zoneDraft.name}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                Updates the zoning proportion bar and permitted/restricted checklists
              </p>
            </div>
            <button
              type="button"
              onClick={() => setZoneDraft(null)}
              className="rounded-full p-1.5 text-ink-soft/60 transition hover:bg-sand-100 hover:text-ink"
              aria-label="Close zone editor"
            >
              <X className="size-4" strokeWidth={2.2} />
            </button>
          </div>

          <form onSubmit={submitZone} className="space-y-4 p-5 sm:p-6">
            <input type="hidden" name="id" value={zoneDraft.id} />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="zone-name" className={labelClass}>
                  Zone name
                </label>
                <input
                  id="zone-name"
                  name="name"
                  required
                  value={zoneDraft.name}
                  onChange={(e) =>
                    setZoneDraft({ ...zoneDraft, name: e.target.value })
                  }
                  className={`${fieldClass} mt-1.5`}
                />
              </div>

              <div>
                <label htmlFor="zone-access" className={labelClass}>
                  Access badge
                </label>
                <input
                  id="zone-access"
                  name="access"
                  required
                  value={zoneDraft.access}
                  onChange={(e) =>
                    setZoneDraft({ ...zoneDraft, access: e.target.value })
                  }
                  className={`${fieldClass} mt-1.5`}
                />
              </div>

              <div>
                <label htmlFor="zone-share" className={labelClass}>
                  Lake share (%)
                </label>
                <input
                  id="zone-share"
                  name="share"
                  type="number"
                  min={5}
                  max={90}
                  required
                  value={zoneDraft.share}
                  onChange={(e) =>
                    setZoneDraft({ ...zoneDraft, share: e.target.value })
                  }
                  className={`${fieldClass} mt-1.5 font-mono`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="zone-summary" className={labelClass}>
                Zone summary
              </label>
              <textarea
                id="zone-summary"
                name="summary"
                required
                rows={2}
                value={zoneDraft.summary}
                onChange={(e) =>
                  setZoneDraft({ ...zoneDraft, summary: e.target.value })
                }
                className={`${fieldClass} mt-1.5`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="zone-allowed" className={labelClass}>
                  Allowed activities (one per line)
                </label>
                <textarea
                  id="zone-allowed"
                  name="allowed"
                  required
                  rows={4}
                  value={zoneDraft.allowed}
                  onChange={(e) =>
                    setZoneDraft({ ...zoneDraft, allowed: e.target.value })
                  }
                  className={`${fieldClass} mt-1.5`}
                />
              </div>

              <div>
                <label htmlFor="zone-restricted" className={labelClass}>
                  Restricted activities (one per line)
                </label>
                <textarea
                  id="zone-restricted"
                  name="restricted"
                  required
                  rows={4}
                  value={zoneDraft.restricted}
                  onChange={(e) =>
                    setZoneDraft({ ...zoneDraft, restricted: e.target.value })
                  }
                  className={`${fieldClass} mt-1.5`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-ink/8 pt-4">
              <button
                type="button"
                onClick={() => setZoneDraft(null)}
                className="rounded-full px-4 py-2 text-[12.5px] font-medium text-ink-soft/75 transition hover:bg-sand-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-lake-800 px-5 py-2 text-[12.5px] font-semibold text-sand-50 transition hover:bg-lake-700 disabled:opacity-60"
              >
                {pending ? "Saving..." : "Save zone"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section
        aria-labelledby="rules-list-heading"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/8 px-5 py-4">
          <div>
            <h2
              id="rules-list-heading"
              className="font-display text-[19px] leading-tight text-ink"
            >
              On-the-water park rules ({rules.length})
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Enforced at every boarding jetty and on all accredited boats
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rulesCustomized ? (
              <button
                type="button"
                onClick={() => resetSection("rules")}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3.5 py-2 text-[12px] font-medium text-ink transition hover:bg-sand-200 disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" strokeWidth={2.2} />
                Reset defaults
              </button>
            ) : null}
            <a
              href="/guidelines"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium text-ink-soft/80 ring-1 ring-ink/10 transition hover:bg-sand-50 hover:text-ink"
            >
              View /guidelines
              <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
            </a>
            <button
              type="button"
              onClick={openNewRule}
              className="inline-flex items-center gap-1.5 rounded-full bg-lake-800 px-4 py-2 text-[12.5px] font-semibold text-sand-50 transition hover:bg-lake-700"
            >
              <Plus className="size-3.5" strokeWidth={2.4} />
              Add rule
            </button>
          </div>
        </div>

        <ul className="divide-y divide-ink/6">
          {rules.map((rule, index) => {
            const Icon = ruleIcons[rule.icon];
            return (
              <li
                key={`${rule.title}-${index}`}
                className="flex flex-wrap items-start gap-4 px-5 py-4 transition-colors hover:bg-sand-50/70"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lake-800 text-sand-50">
                  <Icon className="size-4.5" strokeWidth={1.8} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] text-sand-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[14px] font-medium text-ink">
                      {rule.title}
                    </p>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft/75">
                    {rule.body}
                  </p>
                  {rule.note ? (
                    <p className="mt-1.5 text-[11.5px] text-sand-600">
                      Note: {rule.note}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveRule(index, "up")}
                    disabled={pending || index === 0}
                    className="rounded-full p-1.5 text-ink-soft/60 transition hover:bg-sand-100 hover:text-ink disabled:opacity-30"
                    aria-label={`Move ${rule.title} up`}
                  >
                    <ArrowUp className="size-3.5" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRule(index, "down")}
                    disabled={pending || index === rules.length - 1}
                    className="rounded-full p-1.5 text-ink-soft/60 transition hover:bg-sand-100 hover:text-ink disabled:opacity-30"
                    aria-label={`Move ${rule.title} down`}
                  >
                    <ArrowDown className="size-3.5" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditRule(rule, index)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink-soft/75 transition hover:bg-sand-100 hover:text-ink"
                  >
                    <PencilLine className="size-3.5" strokeWidth={2.2} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRule(index)}
                    disabled={pending || rules.length <= 1}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink-soft/75 transition hover:bg-alert-50 hover:text-alert-700 disabled:opacity-35"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2.2} />
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="zones-list-heading"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/8 px-5 py-4">
          <div>
            <h2
              id="zones-list-heading"
              className="font-display text-[19px] leading-tight text-ink"
            >
              Lake zoning system
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Area share bar and permitted/restricted checklists per park zone
            </p>
          </div>
          {zonesCustomized ? (
            <button
              type="button"
              onClick={() => resetSection("zones")}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3.5 py-2 text-[12px] font-medium text-ink transition hover:bg-sand-200 disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" strokeWidth={2.2} />
              Reset default zones
            </button>
          ) : null}
        </div>

        <div className="border-b border-ink/8 bg-sand-50/70 px-5 py-4">
          <div className="flex h-2.5 overflow-hidden rounded-full">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`${zoneTones[zone.tone].bar} h-full`}
                style={{ width: zone.share }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-5 text-[11px] font-medium text-sand-700">
            {zones.map((zone) => (
              <span key={zone.id} className="inline-flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${zoneTones[zone.tone].dot}`}
                />
                {zone.name} ({zone.share})
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-3">
          {zones.map((zone) => (
            <article
              key={zone.id}
              className="flex flex-col overflow-hidden rounded-2xl bg-sand-50/70 ring-1 ring-ink/10"
            >
              <div className={`h-1 w-full ${zoneTones[zone.tone].accent}`} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold tracking-[0.12em] uppercase ring-1 ring-inset ${zoneTones[zone.tone].badge}`}
                  >
                    {zone.access}
                  </span>
                  <span className="font-mono text-[11.5px] font-medium text-sand-700">
                    {zone.share}
                  </span>
                </div>

                <h3 className="mt-3 font-display text-[19px] leading-snug text-ink">
                  {zone.name}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft/80">
                  {zone.summary}
                </p>

                <div className="mt-4 space-y-1">
                  {zone.allowed.map((item) => (
                    <p
                      key={item}
                      className="flex items-start gap-2 text-[12px] text-ink-soft/85"
                    >
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-moss-600"
                        strokeWidth={2.4}
                      />
                      {item}
                    </p>
                  ))}
                </div>

                <div className="mt-3 space-y-1 border-t border-ink/8 pt-3">
                  {zone.restricted.map((item) => (
                    <p
                      key={item}
                      className="flex items-start gap-2 text-[12px] text-sand-700"
                    >
                      <X
                        className="mt-0.5 size-3.5 shrink-0 text-alert-600"
                        strokeWidth={2.4}
                      />
                      {item}
                    </p>
                  ))}
                </div>

                <div className="mt-auto border-t border-ink/8 pt-4">
                  <button
                    type="button"
                    onClick={() => openEditZone(zone)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-ink/10 transition hover:bg-sand-100"
                  >
                    <PencilLine className="size-3.5" strokeWidth={2.2} />
                    Edit {zone.name.replace(" zone", "").toLowerCase()} zone
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
