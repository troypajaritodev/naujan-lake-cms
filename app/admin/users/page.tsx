"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import { useAuth } from "@/components/auth-provider";
import { listUsers, summariseUsers, type Role, type SessionUser } from "@/lib/auth";

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

type Filter = "ALL" | Role;

const filters: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "admin", label: "Staff" },
  { value: "visitor", label: "Customers" },
];

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
  const [users] = useState<SessionUser[]>(() => listUsers());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const stats = useMemo(() => summariseUsers(users), [users]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = filter === "ALL" || user.role === filter;
      const matchesQuery =
        !needle ||
        user.fullName.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle);
      return matchesRole && matchesQuery;
    });
  }, [users, query, filter]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total accounts"
          value={stats.total}
          hint="Everyone with a login on the portal"
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
          hint="Visitors who can send inquiries"
          tone="lake"
        />
      </div>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
          <div>
            <h2 className="font-display text-[19px] leading-tight text-ink">
              User accounts
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
              aria-label="Filter by role"
              className="flex rounded-full bg-sand-100 p-0.5"
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Account
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Mobile
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {visible.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-sand-50/70">
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
                          {currentUser?.id === user.id && (
                            <span className="rounded-full bg-sand-200 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-sand-800 uppercase">
                              You
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[12px] text-ink-soft/60">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset ${roleStyles[user.role]}`}
                    >
                      {roleLabel[user.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[12px] text-ink-soft/75">
                    {user.phone || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] text-ink-soft/75">
                    {dateFormat.format(new Date(user.createdAt))}
                  </td>
                </tr>
              ))}

              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center">
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
          Customer accounts are created through public registration. Staff
          accounts are provisioned by the park office and always keep full
          access to this panel.
        </p>
      </section>
    </div>
  );
}
