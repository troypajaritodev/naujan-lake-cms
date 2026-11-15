"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, Search, Users } from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import { useAuth } from "@/components/auth-provider";
import {
  AuthError,
  summariseUsers,
  updateUserRole,
  useUsers,
  type Role,
  type SessionUser,
} from "@/lib/auth";

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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
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
            ? `${updated.fullName} can now open this panel and manage the park's content.`
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
            <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          )}
          {feedback.text}
        </p>
      )}

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
              {visible.map((user) => {
                const isSelf = currentUser?.id === user.id;

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
                        aria-describedby={
                          isSelf ? `role-note-${user.id}` : undefined
                        }
                        title={
                          isSelf
                            ? "You cannot change your own role. Ask another staff member."
                            : undefined
                        }
                        className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset outline-none disabled:cursor-not-allowed disabled:opacity-70 ${roleStyles[user.role]}`}
                      >
                        {ROLE_ORDER.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel[role]}
                          </option>
                        ))}
                      </select>
                      {isSelf ? (
                        <p
                          id={`role-note-${user.id}`}
                          className="mt-1.5 text-[10.5px] text-ink-soft/55"
                        >
                          Your own role is locked.
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-ink-soft/75">
                      {user.phone || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] text-ink-soft/75">
                      {dateFormat.format(new Date(user.createdAt))}
                    </td>
                  </tr>
                );
              })}

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
          Customer accounts are created through public registration. Changing a
          role here takes effect immediately: staff can open this panel, customers
          cannot. Your own role is locked, and the last staff account cannot be
          demoted, so the panel always keeps an administrator.
        </p>
      </section>
    </div>
  );
}
