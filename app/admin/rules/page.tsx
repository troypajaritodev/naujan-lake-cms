import type { Metadata } from "next";
import { connection } from "next/server";
import RulesManager from "@/components/admin/rules-manager";
import StatCard from "@/components/admin/stat-card";
import { readOverrides } from "@/lib/content-store";
import { getLakeZones, getParkRules } from "@/lib/guidelines-data";

export const metadata: Metadata = {
  title: "Rules & Zones · Admin",
};

/** Reflects live rule and zoning overrides at request time. */
export const instant = false;

export default async function AdminRulesPage() {
  await connection();

  const [rules, zones, overrides] = await Promise.all([
    getParkRules(),
    getLakeZones(),
    readOverrides(),
  ]);

  const rulesCustomized = overrides.guidelines.rules !== null;
  const zonesCustomized = overrides.guidelines.zones !== null;
  const overrideCount = (rulesCustomized ? 1 : 0) + (zonesCustomized ? 1 : 0);
  const coreZone = zones.find((zone) => zone.tone === "core") ?? zones[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Park rules"
          value={rules.length}
          hint="Live on /guidelines dock rules grid"
          tone="lake"
        />
        <StatCard
          label="Lake zones"
          value={zones.length}
          hint="Managed zones across the Ramsar basin"
          tone="moss"
        />
        <StatCard
          label="Core sanctuary"
          value={coreZone?.share ?? "22%"}
          hint={coreZone?.access ?? "No visitor entry"}
          tone="ink"
        />
        <StatCard
          label="Customised sections"
          value={overrideCount}
          hint={
            overrideCount === 0
              ? "Using park baseline text"
              : "Staff edits active on /guidelines"
          }
          tone="reed"
        />
      </div>

      <RulesManager
        rules={rules}
        zones={zones}
        rulesCustomized={rulesCustomized}
        zonesCustomized={zonesCustomized}
      />
    </div>
  );
}
