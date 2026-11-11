"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Inbox,
  Loader2,
  LogOut,
  Users,
} from "lucide-react";
import BrandMark from "@/components/brand-mark";
import { useAuth } from "@/components/auth-provider";
import { useInquiryAlerts } from "@/lib/inquiry-alerts";

const navigation = [
  {
    href: "/admin/users",
    label: "Users",
    hint: "Accounts, roles and access",
    icon: Users,
  },
  {
    href: "/admin/inquiries",
    label: "Inquiries",
    hint: "Requests and reports",
    icon: Inbox,
  },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, signOut } = useAuth();
  const { pending } = useInquiryAlerts();

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

  const active = navigation.find((item) => pathname.startsWith(item.href));

  return (
    <div className="min-h-svh bg-sand-100/50 lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="flex flex-col bg-lake-950 px-5 py-6 lg:sticky lg:top-0 lg:h-svh">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark className="size-9 bg-white/10" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[17px] text-sand-50">
              Naujan Lake
            </span>
            <span className="mt-1 text-[9px] font-medium tracking-[0.24em] text-sand-300/60 uppercase">
              Content management
            </span>
          </span>
        </Link>

        <nav
          aria-label="Admin sections"
          className="mt-8 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isActive
                    ? "bg-white/10 text-sand-50"
                    : "text-sand-300/70 hover:bg-white/5 hover:text-sand-100"
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
          })}
        </nav>

        <div className="mt-6 border-t border-white/10 pt-5 lg:mt-auto">
          <p className="text-[9.5px] font-semibold tracking-[0.18em] text-sand-400/70 uppercase">
            Signed in
          </p>
          <p className="mt-2 truncate text-[13px] font-medium text-sand-100">
            {user.fullName}
          </p>
          <p className="truncate text-[11.5px] text-sand-300/55">{user.email}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-sand-100 transition-colors hover:bg-white/10"
            >
              View site
              <ArrowUpRight className="size-3" strokeWidth={2} />
            </Link>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-sand-100 transition-colors hover:bg-white/10"
            >
              <LogOut className="size-3" strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-ink/8 bg-sand-50/85 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div>
            <p className="text-[9.5px] font-semibold tracking-[0.18em] text-sand-600 uppercase">
              Admin panel
            </p>
            <h1 className="mt-0.5 font-display text-[20px] leading-tight text-ink">
              {active?.label ?? "Administration"}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
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

            <span className="rounded-full bg-moss-50 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-moss-700 uppercase ring-1 ring-moss-600/20 ring-inset">
              Administrator
            </span>
          </div>
        </header>

        <main className="flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
