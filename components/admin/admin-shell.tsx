"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bird,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Route,
  Scale,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import BrandMark from "@/components/brand-mark";
import { useAuth } from "@/components/auth-provider";
import { useInquiryAlerts } from "@/lib/inquiry-alerts";

const navigation = [
  {
    href: "/admin",
    label: "Overview",
    hint: "What needs attention",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/users",
    label: "Users",
    hint: "Accounts, roles and access",
    icon: Users,
  },
  {
    href: "/admin/inquiries",
    label: "Bookings",
    hint: "Deposits, status & tracking",
    icon: Inbox,
  },
  {
    href: "/admin/subscribers",
    label: "Subscribers",
    hint: "Newsletter & advisory alerts",
    icon: Mail,
  },
  {
    href: "/admin/advisories",
    label: "Advisories",
    hint: "Publish park notices",
    icon: Megaphone,
  },
  {
    href: "/admin/tours",
    label: "Packages",
    hint: "Rates, seats and availability",
    icon: Route,
  },
  {
    href: "/admin/species",
    label: "Wildlife",
    hint: "Species catalogue & status",
    icon: Bird,
  },
  {
    href: "/admin/rules",
    label: "Rules & Zones",
    hint: "Park rules & lake zoning",
    icon: Scale,
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, signOut } = useAuth();
  const { pending } = useInquiryAlerts();
  const [navOpen, setNavOpen] = useState(false);

  const authorised = ready && user?.role === "admin";

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (user.role !== "admin") {
      // Signed in, but this is a customer — send them to their own dashboard.
      router.replace("/account");
    }
  }, [ready, user, router, pathname]);

  useEffect(() => {
    if (!navOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen]);

  if (!authorised || !user) {
    return (
      <div className="grid min-h-svh place-items-center bg-sand-50">
        <p className="flex items-center gap-2 text-[13px] text-sand-600">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          {ready ? "Taking you to sign in…" : "Checking access…"}
        </p>
      </div>
    );
  }

  // `/admin` is a prefix of every other item, so the landing page only matches
  // exactly — otherwise the header would read "Overview" on every screen.
  const isItemActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const active = navigation.find((item) => isItemActive(item.href));

  const navLinks = (onNavigate?: () => void) =>
    navigation.map((item) => {
      const isActive = isItemActive(item.href);

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive ? "page" : undefined}
          className={`group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
            isActive
              ? "bg-white/12 text-sand-50 ring-1 ring-white/12 ring-inset shadow-[0_8px_20px_-14px_rgba(0,0,0,0.6)]"
              : "text-sand-300/75 hover:bg-white/6 hover:text-sand-100"
          }`}
        >
          <item.icon
            className={`size-4 shrink-0 ${isActive ? "text-reed-300" : ""}`}
            strokeWidth={1.9}
            aria-hidden="true"
          />
          <span className="flex flex-col">
            <span className="text-[13.5px] font-medium">{item.label}</span>
            <span className="hidden text-[11px] text-sand-400/60 lg:block">
              {item.hint}
            </span>
          </span>
          {item.href === "/admin/inquiries" && pending > 0 ? (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-alert-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-alert-100 ring-1 ring-alert-500/40 ring-inset tabular-nums">
              <span className="size-1.5 rounded-full bg-alert-500" />
              {pending}
              <span className="sr-only">
                {pending === 1 ? "pending request" : "pending requests"}
              </span>
            </span>
          ) : null}
        </Link>
      );
    });

  const userCard = (
    <div className="mt-6 border-t border-white/10 pt-5 lg:mt-auto">
      <p className="text-[9.5px] font-semibold tracking-[0.18em] text-sand-400/70 uppercase">
        Signed in
      </p>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-semibold tracking-[0.04em] text-sand-100"
        >
          {initials(user.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-sand-100">
            {user.fullName}
          </p>
          <p className="truncate text-[11.5px] text-sand-300/55">{user.email}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-sand-100 transition-colors hover:bg-white/10"
        >
          My account
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-sand-100 transition-colors hover:bg-white/10"
        >
          View site
          <ArrowUpRight className="size-3" strokeWidth={2} />
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-sand-100 transition-colors hover:bg-white/10"
        >
          <LogOut className="size-3" strokeWidth={2} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-svh bg-sand-100/55 lg:grid lg:grid-cols-[268px_1fr]">
      <aside className="relative hidden flex-col overflow-hidden bg-lake-950 px-5 py-6 lg:sticky lg:top-0 lg:flex lg:h-svh">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_45%_at_15%_0%,rgba(51,135,133,0.22),transparent_70%)]"
        />
        <Link href="/" className="relative flex items-center gap-3">
          <BrandMark className="size-10 ring-white/25" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[17px] text-sand-50">
              Naujan Lake
            </span>
            <span className="mt-1 text-[9px] font-medium tracking-[0.24em] text-sand-300/60 uppercase">
              Content management
            </span>
          </span>
        </Link>

        <nav aria-label="Admin sections" className="mt-8 flex flex-col gap-1">
          {navLinks()}
        </nav>

        {userCard}
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-ink/8 bg-sand-50/85 px-5 py-3.5 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open admin menu"
              aria-expanded={navOpen}
              aria-controls="admin-drawer"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/12 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink lg:hidden"
            >
              <Menu className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
            </button>

            <div className="min-w-0">
              <p className="text-[9.5px] font-semibold tracking-[0.18em] text-sand-600 uppercase">
                Admin panel
              </p>
              <h1 className="mt-0.5 truncate font-display text-[20px] leading-tight text-ink">
                {active?.label ?? "Administration"}
              </h1>
              {active ? (
                <p className="mt-0.5 hidden truncate text-[12px] text-ink-soft/60 sm:block">
                  {active.hint}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {pending > 0 ? (
              <Link
                href="/admin/inquiries"
                className="group inline-flex items-center gap-2 rounded-full border border-alert-500/25 bg-alert-50 py-1.5 pr-2.5 pl-3 text-[11.5px] font-semibold text-alert-700 transition-colors hover:border-alert-500/40 hover:bg-alert-100"
                aria-label={`${pending} pending ${pending === 1 ? "request" : "requests"} awaiting review`}
              >
                <span className="relative flex size-2 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-alert-500/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-alert-500" />
                </span>
                <span className="tabular-nums">{pending}</span>
                <span className="hidden font-medium sm:inline">
                  {pending === 1 ? "request" : "requests"} awaiting review
                </span>
                <ArrowRight
                  className="size-3 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.4}
                />
              </Link>
            ) : null}

            <span className="hidden items-center gap-1.5 rounded-full bg-moss-50 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-moss-700 uppercase ring-1 ring-moss-600/20 ring-inset sm:inline-flex">
              <ShieldCheck className="size-3" strokeWidth={2.2} aria-hidden="true" />
              Administrator
            </span>
          </div>
        </header>

        <main className="flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>

      {/* Mobile drawer — the sidebar keeps its width only on large screens. */}
      {navOpen && (
        <div
          id="admin-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
          />

          <div className="relative flex h-full w-[84%] max-w-xs flex-col overflow-y-auto bg-lake-950 px-5 py-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <Link
                href="/"
                onClick={() => setNavOpen(false)}
                className="flex items-center gap-3"
              >
                <BrandMark className="size-10 ring-white/25" />
                <span className="flex flex-col leading-none">
                  <span className="font-display text-[17px] text-sand-50">
                    Naujan Lake
                  </span>
                  <span className="mt-1 text-[9px] font-medium tracking-[0.24em] text-sand-300/60 uppercase">
                    Content management
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close admin menu"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-white/20 text-sand-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Admin sections" className="mt-8 flex flex-col gap-1">
              {navLinks(() => setNavOpen(false))}
            </nav>

            {userCard}
          </div>
        </div>
      )}
    </div>
  );
}
