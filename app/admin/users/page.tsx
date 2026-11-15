"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Download,
  Eye,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import { useAuth } from "@/components/auth-provider";
import { downloadCsv } from "@/lib/csv";
import {
  AuthError,
  setUserActive,
  summariseUsers,
  updateUserRole,
  useUsers,
  type Role,
  type SessionUser,
} from "@/lib/auth";
import { useInquiries, type Inquiry } from "@/lib/inquiries";
import { INQUIRY_STATUS_META, PAYMENT_STATUS_META } from "@/lib/inquiry-status";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const roleStyles: Record<Role, string> = {
  admin: "bg-moss-50 text-moss-700 ring-moss-600/20",
  visitor: "bg-lake-50 text-lake-700 ring-lake-600/20",
};

const roleLabel: Record<Role, string> = {
  admin: "Staff",
  visitor: "Customer",
};

type Filter = "ALL" | Role | "SUSPENDED";

const filters: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "admin", label: "Staff" },
  { value: "visitor", label: "Customers" },
  { value: "SUSPENDED", label: "Suspended" },
];

const ROLE_ORDER: Role[] = ["visitor", "admin"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const users = useUsers();
  const inquiries = useInquiries();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "warn";
    text: string;
  } | null>(null);

  function changeRole(user: SessionUser, role: Role) {
    if (user.role === role) return;

    setFeedback(null);
    try {
      const updated = updateUserRole(user.id, role);
      setFeedback({
        tone: "ok",
        text:
          role === "admin"
            ? `${updated.fullName} can now open this panel and manage bookings and content.`
            : `${updated.fullName} is now a customer and keeps their bookings and profile.`,
      });
    } catch (error) {
      setFeedback({
        tone: "warn",
        text:
          error instanceof AuthError
            ? error.message
            : "Could not change that role. Try again.",
      });
    }
  }

  function toggleStatus(user: SessionUser) {
    const nextActive = user.isActive === false;
    setFeedback(null);
    try {
      const updated = setUserActive(user.id, nextActive);
      setFeedback({
        tone: "ok",
        text: nextActive
          ? `${updated.fullName} is now active and can sign in.`
          : `${updated.fullName} has been suspended from signing in.`,
      });
    } catch (error) {
      setFeedback({
        tone: "warn",
        text:
          error instanceof AuthError
            ? error.message
            : "Could not update account status.",
      });
    }
  }

  const bookingSummaryByEmail = useMemo(() => {
    const map = new Map<
      string,
      { total: number; active: number; paid: number; items: Inquiry[] }
    >();
    for (const item of inquiries) {
      const key = item.userEmail.trim().toLowerCase();
      const entry = map.get(key) ?? {
        total: 0,
        active: 0,
        paid: 0,
        items: [],
      };
      entry.total += 1;
      if (
        item.status === "PENDING" ||
        item.status === "ON_PROCESS" ||
        item.status === "CONTACTED" ||
        item.status === "CONFIRMED"
      ) {
        entry.active += 1;
      }
      if (
        item.paymentStatus !== "UNPAID" &&
        item.paymentStatus !== "REFUNDED"
      ) {
        entry.paid += item.firstPaymentAmount ?? 0;
      }
      entry.items.push(item);
      map.set(key, entry);
    }
    return map;
  }, [inquiries]);

  const stats = useMemo(() => summariseUsers(users), [users]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesFilter =
        filter === "ALL"
          ? true
          : filter === "SUSPENDED"
            ? user.isActive === false
            : user.role === filter;
      const matchesQuery =
        !needle ||
        user.fullName.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [users, query, filter]);

  const inspectedUser = useMemo(
    () => users.find((u) => u.id === inspectUserId) ?? null,
    [users, inspectUserId],
  );
  const inspectedBookings = useMemo(() => {
    if (!inspectedUser) return [];
    return (
      bookingSummaryByEmail.get(inspectedUser.email.trim().toLowerCase())
        ?.items ?? []
    );
  }, [inspectedUser, bookingSummaryByEmail]);

  function handleExportUsersCsv() {
    downloadCsv(
      `naujan-users-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Full Name",
        "Email",
        "Phone",
        "Role",
        "Account Status",
        "Location",
        "Emergency Contact",
        "Bookings",
        "Deposits Paid PHP",
        "Joined At",
      ],
      visible.map((u) => {
        const activity = bookingSummaryByEmail.get(u.email.trim().toLowerCase());
        return [
          u.fullName,
          u.email,
          u.phone,
          u.role,
          u.isActive === false ? "Suspended" : "Active",
          u.address ?? "",
          u.emergencyContact ?? "",
          activity?.total ?? 0,
          activity?.paid ?? 0,
          u.createdAt,
        ];
      }),
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[12.5px] ring-1 ring-inset ${
            feedback.tone === "ok"
              ? "bg-moss-50 text-moss-800 ring-moss-600/20"
              : "bg-alert-50 text-alert-700 ring-alert-500/20"
          }`}
        >
          {feedback.tone === "ok" ? (
            <Check
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={2.4}
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
          {feedback.text}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total accounts"
          value={stats.total}
          hint={`${stats.active} active · ${stats.suspended} suspended`}
          tone="ink"
        />
        <StatCard
          label="Park staff"
          value={stats.staff}
          hint="Full access to this panel"
          tone="moss"
        />
        <StatCard
          label="Customers"
          value={stats.customers}
          hint="Visitors who book & track trips"
          tone="lake"
        />
        <StatCard
          label="Suspended"
          value={stats.suspended}
          hint="Blocked from signing in"
          tone="alert"
        />
      </div>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
          <div>
            <h2 className="font-display text-[19px] leading-tight text-ink">
              User accounts &amp; booking activity
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              {visible.length} of {stats.total} shown
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-sand-500"
                strokeWidth={2}
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or email"
                aria-label="Search accounts"
                className="w-56 rounded-full border border-ink/12 bg-white py-2 pr-3 pl-9 text-[13px] text-ink transition-colors outline-none placeholder:text-sand-400 focus:border-lake-600 focus:ring-3 focus:ring-lake-600/15"
              />
            </div>

            <div
              role="group"
              aria-label="Filter by role or status"
              className="flex flex-wrap rounded-full bg-sand-100 p-0.5"
            >
              {filters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    filter === option.value
                      ? "bg-white text-ink shadow-[0_1px_2px_rgba(12,26,23,0.12)]"
                      : "text-ink-soft/70 hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportUsersCsv}
              disabled={visible.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 py-2 text-[12px] font-semibold text-ink transition-colors hover:bg-sand-50 disabled:opacity-45"
            >
              <Download className="size-3.5 text-sand-600" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Account
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Account status
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Bookings &amp; Deposits
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Joined
                </th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {visible.map((user) => {
                const isSelf = currentUser?.id === user.id;
                const isActive = user.isActive !== false;
                const activity = bookingSummaryByEmail.get(
                  user.email.trim().toLowerCase(),
                );

                return (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-sand-50/70"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-lake-50 font-mono text-[11px] font-medium text-lake-700"
                        >
                          {initials(user.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                            {user.fullName}
                            {isSelf && (
                              <span className="rounded-full bg-sand-200 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-sand-800 uppercase">
                                You
                              </span>
                            )}
                          </p>
                          <p className="truncate text-[12px] text-ink-soft/60">
                            {user.email}
                            {user.phone ? ` · ${user.phone}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={user.role}
                        onChange={(event) =>
                          changeRole(user, event.target.value as Role)
                        }
                        disabled={isSelf}
                        aria-label={`Role for ${user.fullName}`}
                        className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset outline-none disabled:cursor-not-allowed disabled:opacity-70 ${roleStyles[user.role]}`}
                      >
                        {ROLE_ORDER.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => toggleStatus(user)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-65 ${
                          isActive
                            ? "bg-moss-50 text-moss-700 ring-moss-600/25 hover:bg-moss-100"
                            : "bg-alert-50 text-alert-700 ring-alert-500/25 hover:bg-alert-100"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <ShieldCheck className="size-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="size-3" />
                            Suspended
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      {activity && activity.total > 0 ? (
                        <div>
                          <p className="text-[12.5px] font-medium text-ink">
                            {activity.total}{" "}
                            {activity.total === 1 ? "booking" : "bookings"}
                            {activity.active > 0 && (
                              <span className="ml-1.5 text-[11px] font-semibold text-lake-700">
                                ({activity.active} active)
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-sand-600">
                            {peso.format(activity.paid)} first payments
                          </p>
                        </div>
                      ) : (
                        <span className="text-[12px] text-ink-soft/50">
                          No bookings
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] text-ink-soft/75">
                      {dateFormat.format(new Date(user.createdAt))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectUserId(user.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition-colors hover:bg-sand-100"
                      >
                        <Eye className="size-3" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}

              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Users
                      className="mx-auto size-6 text-sand-400"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-[13.5px] font-medium text-ink">
                      No accounts match that filter
                    </p>
                    <p className="mt-1 text-[12.5px] text-ink-soft/65">
                      Try a different search term or role.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="border-t border-ink/8 px-5 py-3.5 text-[11.5px] leading-relaxed text-sand-700">
          Your own role and active status are locked, and the last active staff
          account cannot be demoted or suspended so the admin panel always keeps
          an administrator.
        </p>
      </section>

      {/* User Inspector Drawer */}
      {inspectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Account details for ${inspectedUser.fullName}`}
          className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-sm"
        >
          <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-sand-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-white px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                  {roleLabel[inspectedUser.role]} account
                </p>
                <h2 className="mt-0.5 font-display text-[20px] text-ink">
                  {inspectedUser.fullName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInspectUserId(null)}
                aria-label="Close account inspector"
                className="grid size-9 place-items-center rounded-full border border-ink/12 hover:bg-sand-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                  Profile &amp; manifest details
                </p>
                <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-sand-600">Email</dt>
                    <dd className="font-medium text-ink">
                      {inspectedUser.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">Mobile</dt>
                    <dd className="font-mono text-ink">
                      {inspectedUser.phone || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">City / Province</dt>
                    <dd className="text-ink">{inspectedUser.address || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">Emergency contact</dt>
                    <dd className="text-ink">
                      {inspectedUser.emergencyContact || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">Joined</dt>
                    <dd className="text-ink">
                      {dateFormat.format(new Date(inspectedUser.createdAt))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">Status</dt>
                    <dd className="font-medium text-ink">
                      {inspectedUser.isActive === false
                        ? "Suspended"
                        : "Active"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                    Booking history ({inspectedBookings.length})
                  </p>
                  <Link
                    href="/admin/inquiries"
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-lake-700 hover:text-lake-900"
                  >
                    Open bookings queue
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                {inspectedBookings.length === 0 ? (
                  <p className="mt-3 text-[12.5px] text-ink-soft/65">
                    This user has not placed any bookings yet.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-ink/8">
                    {inspectedBookings.map((booking) => {
                      const sMeta = INQUIRY_STATUS_META[booking.status];
                      const pMeta =
                        PAYMENT_STATUS_META[booking.paymentStatus ?? "UNPAID"];
                      return (
                        <li key={booking.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-mono text-[11.5px] text-lake-800">
                                {booking.reference}
                              </p>
                              <p className="text-[13px] font-medium text-ink">
                                {booking.tourTitle}
                              </p>
                              <p className="mt-0.5 text-[11.5px] text-ink-soft/70">
                                {booking.preferredDate} · {booking.partySize}{" "}
                                guests · First payment{" "}
                                {peso.format(booking.firstPaymentAmount ?? 0)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase ring-1 ring-inset ${sMeta.chip}`}
                              >
                                {sMeta.label}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ring-1 ring-inset ${pMeta.chip}`}
                              >
                                {pMeta.label}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
