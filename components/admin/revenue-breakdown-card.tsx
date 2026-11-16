"use client";

import Link from "next/link";
import { ArrowRight, Coins, Layers, Percent, TrendingUp } from "lucide-react";
import {
  FACILITATION_FEE_PHP,
  formatPhpAmount as formatPhp,
  OPERATOR_COMMISSION_RATE,
  summarizePortfolioEconomics,
  VARIABLE_COST_PER_BOOKING_PHP,
  type Inquiry,
} from "@/lib/inquiries";

type RevenueBreakdownCardProps = {
  inquiries: readonly Inquiry[];
  showPackageTable?: boolean;
  manageHref?: string;
};

/**
 * Displays realized platform profit vs. gross operator tariffs per
 * `docs/REVENUE_MODEL.md` (₱150 flat facilitation fee + 8% operator commission,
 * less ₱72/booking variable servicing costs).
 */
export default function RevenueBreakdownCard({
  inquiries,
  showPackageTable = false,
  manageHref,
}: RevenueBreakdownCardProps) {
  const summary = summarizePortfolioEconomics(inquiries);

  const commissionPct = Math.round(OPERATOR_COMMISSION_RATE * 100);
  const operatorSharePct =
    summary.grossBookingValue > 0
      ? Math.round((summary.operatorNetPayout / summary.grossBookingValue) * 1000) / 10
      : 0;
  const platformSharePct =
    summary.grossBookingValue > 0
      ? Math.round((summary.platformRevenue / summary.grossBookingValue) * 1000) / 10
      : 0;

  return (
    <section
      aria-labelledby="platform-revenue-heading"
      className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
            Revenue &amp; Commission Ledger
          </p>
          <h2
            id="platform-revenue-heading"
            className="mt-0.5 font-display text-[19px] leading-tight text-ink"
          >
            Platform Profit Breakdown
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-soft/70">
            {formatPhp(FACILITATION_FEE_PHP)} facilitation fee + {commissionPct}% operator
            commission across {summary.realizedCount} active/verified booking
            {summary.realizedCount === 1 ? "" : "s"}
            {summary.pendingCount > 0
              ? ` · ${formatPhp(summary.pendingPlatformRevenue)} in pending queue (${summary.pendingCount})`
              : ""}
          </p>
        </div>

        {manageHref ? (
          <Link
            href={manageHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-sand-50 px-3.5 py-1.5 text-[12px] font-semibold text-ink ring-1 ring-ink/10 transition hover:bg-sand-100"
          >
            Full revenue ledger
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="rounded-full bg-moss-50 px-3 py-1 font-mono text-[11px] font-semibold text-moss-800 ring-1 ring-moss-600/20">
            Margin: {summary.contributionMarginPct}%
          </span>
        )}
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-moss-50/75 p-4 ring-1 ring-moss-600/20">
          <div className="flex items-center justify-between text-[11px] font-semibold text-moss-800">
            <span>Platform Revenue</span>
            <TrendingUp className="size-3.5 text-moss-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-[26px] leading-none font-light text-ink tabular-nums">
            {formatPhp(summary.platformRevenue)}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-soft/75">
            {platformSharePct}% of {formatPhp(summary.grossBookingValue)} gross value
          </p>
        </div>

        <div className="rounded-xl bg-lake-50/65 p-4 ring-1 ring-lake-600/20">
          <div className="flex items-center justify-between text-[11px] font-semibold text-lake-900">
            <span>Facilitation Fees</span>
            <Coins className="size-3.5 text-lake-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-[26px] leading-none font-light text-ink tabular-nums">
            {formatPhp(summary.facilitationFees)}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-soft/75">
            {formatPhp(FACILITATION_FEE_PHP)} flat per visitor booking
          </p>
        </div>

        <div className="rounded-xl bg-sand-50/90 p-4 ring-1 ring-ink/8">
          <div className="flex items-center justify-between text-[11px] font-semibold text-sand-800">
            <span>Operator Commissions ({commissionPct}%)</span>
            <Percent className="size-3.5 text-sand-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-[26px] leading-none font-light text-ink tabular-nums">
            {formatPhp(summary.operatorCommissions)}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-soft/75">
            On {formatPhp(summary.operatorGrossTariffs)} gross tour tariffs
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 ring-1 ring-ink/10">
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink">
            <span>Net Contribution</span>
            <Layers className="size-3.5 text-moss-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-[26px] leading-none font-light text-moss-800 tabular-nums">
            {formatPhp(summary.netPlatformContribution)}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-soft/75">
            Less {formatPhp(summary.estimatedVariableCosts)} est. servicing (
            {formatPhp(VARIABLE_COST_PER_BOOKING_PHP)}/booking)
          </p>
        </div>
      </div>

      {/* Allocation split strip */}
      <div className="border-t border-ink/6 bg-sand-50/55 px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-soft/85">
          <span>
            Operator &amp; park settlement:{" "}
            <strong className="font-mono text-ink">
              {formatPhp(summary.operatorNetPayout)}
            </strong>{" "}
            ({operatorSharePct}%)
          </span>
          <span>
            Platform take:{" "}
            <strong className="font-mono text-moss-800">
              {formatPhp(summary.platformRevenue)}
            </strong>{" "}
            (Margin: <strong className="font-mono">{summary.contributionMarginPct}%</strong>
            )
          </span>
        </div>
        {summary.grossBookingValue > 0 && (
          <div
            className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-sand-200"
            role="presentation"
          >
            <div
              className="h-full bg-lake-700"
              style={{ width: `${Math.max(0, Math.min(100, operatorSharePct))}%` }}
            />
            <div
              className="h-full bg-moss-600"
              style={{ width: `${Math.max(0, Math.min(100, platformSharePct))}%` }}
            />
          </div>
        )}
      </div>

      {showPackageTable && (
        <div className="border-t border-ink/8 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Package (Realized)
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Bookings
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Gross Tariff
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Facilitation Fees
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  {commissionPct}% Commission
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Platform Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {summary.byPackage.map((row) => (
                <tr key={row.slug || row.title} className="hover:bg-sand-50/50">
                  <td className="px-5 py-3 text-[13px] font-medium text-ink">
                    {row.title}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-ink">
                    {row.bookings}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-ink-soft">
                    {formatPhp(row.grossTariff)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-lake-800">
                    {formatPhp(row.facilitationFees)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-ink">
                    {formatPhp(row.operatorCommission)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] font-semibold text-moss-800">
                    {formatPhp(row.platformRevenue)}
                  </td>
                </tr>
              ))}
              {summary.byPackage.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-[13px] text-ink-soft/65"
                  >
                    No realized bookings yet. Revenue calculates once requests are
                    accepted, confirmed, or deposit-verified.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
