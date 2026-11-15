"use server";

import { updateTag } from "next/cache";
import { updateOverrides } from "@/lib/content-store";
import {
  lakeZones,
  parkRules,
  type ParkRule,
  type Zone,
} from "@/lib/guidelines";
import { cleanText, toCleanLines } from "@/lib/sanitize";
import { requireAdminSession } from "@/lib/server-auth";

export type RulesActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; field?: string };

const RULE_ICONS: ParkRule["icon"][] = [
  "litter",
  "camera",
  "fish",
  "lifejacket",
  "route",
  "collect",
];

function field(formData: FormData, name: string, maxLength: number): string {
  return cleanText(String(formData.get(name) ?? ""), maxLength);
}

export async function saveParkRuleAction(
  formData: FormData,
): Promise<RulesActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  const indexRaw = field(formData, "index", 8);
  const parsedIndex = indexRaw === "" ? -1 : Number(indexRaw);
  const icon = field(formData, "icon", 24) as ParkRule["icon"];
  const title = field(formData, "title", 120);
  const body = field(formData, "body", 450);
  const note = field(formData, "note", 240);

  if (!RULE_ICONS.includes(icon)) {
    return { ok: false, field: "icon", message: "Pick an icon for this rule." };
  }
  if (title.length < 3) {
    return {
      ok: false,
      field: "title",
      message: "Enter a short rule title (at least 3 characters).",
    };
  }
  if (body.length < 8) {
    return {
      ok: false,
      field: "body",
      message: "Add clear guidance text for visitors (at least 8 characters).",
    };
  }

  const nextRule: ParkRule = {
    icon,
    title,
    body,
    ...(note ? { note } : {}),
  };

  let updatedExisting = false;

  await updateOverrides((current) => {
    const existing = [...(current.guidelines.rules ?? parkRules)];
    if (
      Number.isInteger(parsedIndex) &&
      parsedIndex >= 0 &&
      parsedIndex < existing.length
    ) {
      existing[parsedIndex] = nextRule;
      updatedExisting = true;
    } else {
      existing.push(nextRule);
    }

    return {
      ...current,
      guidelines: { ...current.guidelines, rules: existing },
    };
  });

  updateTag("guidelines");

  return {
    ok: true,
    message: updatedExisting
      ? `Updated park rule “${nextRule.title}”. Live on /guidelines.`
      : `Added park rule “${nextRule.title}” to /guidelines.`,
  };
}

export async function deleteParkRuleAction(
  index: number,
): Promise<RulesActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  let blocked = false;
  let removedTitle = "";

  await updateOverrides((current) => {
    const existing = [...(current.guidelines.rules ?? parkRules)];
    if (existing.length <= 1) {
      blocked = true;
      return current;
    }
    if (!Number.isInteger(index) || index < 0 || index >= existing.length) {
      return current;
    }
    removedTitle = existing[index].title;
    const next = existing.filter((_, idx) => idx !== index);
    return {
      ...current,
      guidelines: { ...current.guidelines, rules: next },
    };
  });

  if (blocked) {
    return {
      ok: false,
      message: "Keep at least one rule published on the guidelines page.",
    };
  }

  updateTag("guidelines");

  return {
    ok: true,
    message: removedTitle
      ? `Removed “${removedTitle}” from /guidelines.`
      : "Rule removed.",
  };
}

export async function moveParkRuleAction(
  index: number,
  direction: "up" | "down",
): Promise<RulesActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  const delta = direction === "up" ? -1 : 1;

  await updateOverrides((current) => {
    const existing = [...(current.guidelines.rules ?? parkRules)];
    const target = index + delta;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= existing.length ||
      target < 0 ||
      target >= existing.length
    ) {
      return current;
    }

    const next = [...existing];
    [next[index], next[target]] = [next[target], next[index]];
    return {
      ...current,
      guidelines: { ...current.guidelines, rules: next },
    };
  });

  updateTag("guidelines");

  return { ok: true, message: "Updated rule display order on /guidelines." };
}

export async function saveLakeZoneAction(
  formData: FormData,
): Promise<RulesActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  const zoneId = field(formData, "id", 40);
  const name = field(formData, "name", 90);
  const access = field(formData, "access", 60);
  const summary = field(formData, "summary", 360);
  const shareRaw = field(formData, "share", 8).replace("%", "").trim();
  const sharePercent = Number(shareRaw);
  const allowed = toCleanLines(String(formData.get("allowed") ?? ""), 12, 140);
  const restricted = toCleanLines(
    String(formData.get("restricted") ?? ""),
    12,
    140,
  );

  if (!zoneId) {
    return { ok: false, message: "Missing zone identifier." };
  }
  if (name.length < 3) {
    return { ok: false, field: "name", message: "Enter a zone title." };
  }
  if (access.length < 3) {
    return {
      ok: false,
      field: "access",
      message: "Enter the access badge label (e.g. No visitor entry).",
    };
  }
  if (summary.length < 10) {
    return {
      ok: false,
      field: "summary",
      message: "Summarize how this zone is managed (at least 10 characters).",
    };
  }
  if (!Number.isFinite(sharePercent) || sharePercent < 5 || sharePercent > 90) {
    return {
      ok: false,
      field: "share",
      message: "Zone area share must be a number between 5% and 90%.",
    };
  }
  if (allowed.length === 0) {
    return {
      ok: false,
      field: "allowed",
      message: "List at least one permitted activity (one per line).",
    };
  }
  if (restricted.length === 0) {
    return {
      ok: false,
      field: "restricted",
      message: "List at least one restricted activity (one per line).",
    };
  }

  let matched = false;

  await updateOverrides((current) => {
    const existing = [...(current.guidelines.zones ?? lakeZones)];
    const idx = existing.findIndex((item) => item.id === zoneId);
    if (idx < 0) return current;

    matched = true;
    const prev: Zone = existing[idx];
    existing[idx] = {
      ...prev,
      name,
      access,
      summary,
      share: `${Math.round(sharePercent)}%`,
      allowed,
      restricted,
    };

    return {
      ...current,
      guidelines: { ...current.guidelines, zones: existing },
    };
  });

  if (!matched) {
    return { ok: false, message: "Unknown lake zone." };
  }

  updateTag("guidelines");

  return {
    ok: true,
    message: `Updated “${name}” zoning rules on /guidelines.`,
  };
}

export async function resetGuidelinesAction(
  scope: "rules" | "zones",
): Promise<RulesActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  await updateOverrides((current) => ({
    ...current,
    guidelines: {
      ...current.guidelines,
      ...(scope === "rules" ? { rules: null } : { zones: null }),
    },
  }));

  updateTag("guidelines");

  return {
    ok: true,
    message:
      scope === "rules"
        ? "Restored default park rules on /guidelines."
        : "Restored default lake zoning framework on /guidelines.",
  };
}
