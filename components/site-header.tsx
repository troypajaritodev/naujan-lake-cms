"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Clock, MapPin, Menu, Phone, User, X } from "lucide-react";
import BrandMark from "@/components/brand-mark";
import { useAuth } from "@/components/auth-provider";
import { navigation, site } from "@/lib/site";

export default function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, ready } = useAuth();

  const accountLabel =
    ready && user ? user.fullName.split(" ")[0] : "Sign in";
  const accountHref = ready && user ? "/account" : "/login";

  const isHome = pathname === "/";
  // Floats over the hero photo until the page scrolls or the drawer opens.
  const overHero = isHome && !scrolled;
  const onDark = overHero || menuOpen;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const linkIdle = onDark
    ? "text-sand-100/75 hover:text-white"
    : "text-ink-soft hover:text-ink";
  const linkActive = onDark ? "text-white" : "text-ink";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-500 ${
        onDark
          ? "border-b border-transparent bg-transparent"
          : "border-b border-ink/10 bg-sand-50/85 shadow-[0_1px_0_0_rgba(12,26,23,0.04)] backdrop-blur-xl"
      }`}
    >
      {/* Utility strip — collapses away as soon as the page scrolls. */}
      <div
        className={`hidden overflow-hidden border-b transition-all duration-500 lg:block ${
          onDark ? "border-white/15 text-sand-100/70" : "border-ink/10 text-sand-700"
        } ${scrolled ? "max-h-0 opacity-0" : "max-h-10 opacity-100"}`}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-2.5 text-[11px] font-medium tracking-[0.16em] uppercase sm:px-8 lg:px-12">
          <p className="flex items-center gap-2">
            <MapPin className="size-3" strokeWidth={1.8} />
            {site.region}
            <span className="mx-1 opacity-40">/</span>
            {site.ramsar}
          </p>
          <p className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <Clock className="size-3" strokeWidth={1.8} />
              {site.hours}
            </span>
            <span className="flex items-center gap-2">
              <Phone className="size-3" strokeWidth={1.8} />
              Emergency {site.emergency}
            </span>
          </p>
        </div>
      </div>

      <div
        className={`relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 transition-all duration-500 sm:px-8 lg:px-12 ${
          scrolled ? "py-3" : "py-4"
        }`}
      >
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label={`${site.park} — home`}
        >
          <BrandMark
            className={`size-10 transition-colors duration-500 ${
              overHero ? "bg-white/10 backdrop-blur-md" : ""
            }`}
          />
          <span className="flex flex-col leading-none">
            <span
              className={`font-display text-[19px] font-medium tracking-[-0.01em] transition-colors duration-500 ${
                onDark ? "text-sand-50" : "text-ink"
              }`}
            >
              Naujan Lake
            </span>
            <span
              className={`mt-1 text-[9px] font-medium tracking-[0.28em] uppercase transition-colors duration-500 ${
                onDark ? "text-sand-100/60" : "text-sand-600"
              }`}
            >
              National Park
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {navigation.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`group relative py-1 text-[13.5px] font-medium transition-colors duration-300 ${
                  isActive ? linkActive : linkIdle
                }`}
              >
                {item.label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-current transition-transform duration-300 ${
                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={accountHref}
            className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors duration-300 sm:inline-flex ${
              onDark ? "text-sand-100/80 hover:text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            <User className="size-4" strokeWidth={1.8} aria-hidden="true" />
            {accountLabel}
          </Link>

          <Link
            href="/inquire"
            className={`hidden items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-300 sm:inline-flex ${
              onDark
                ? "bg-sand-50 text-ink hover:bg-white"
                : "bg-lake-800 text-sand-50 hover:bg-lake-700"
            }`}
          >
            Plan a visit
            <ArrowUpRight className="size-4" strokeWidth={2} />
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className={`grid size-10 place-items-center rounded-full border transition-colors duration-300 lg:hidden ${
              onDark
                ? "border-white/25 text-sand-50 hover:bg-white/10"
                : "border-ink/15 text-ink hover:bg-ink/5"
            }`}
          >
            {menuOpen ? (
              <X className="size-5" strokeWidth={1.8} />
            ) : (
              <Menu className="size-5" strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer — sits behind the header bar so the close button stays reachable. */}
      <div
        id="mobile-menu"
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-0 lg:hidden ${
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-lake-950 transition-opacity duration-500 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`relative flex h-full flex-col justify-between overflow-y-auto px-5 pt-28 pb-10 transition-all duration-500 sm:px-8 ${
            menuOpen ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {navigation.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => setMenuOpen(false)}
                className="group flex items-baseline gap-4 border-b border-white/10 py-5"
              >
                <span className="font-mono text-[11px] text-sand-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1">
                  <span className="font-display text-2xl text-sand-50">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-[13px] text-sand-200/60">
                    {item.description}
                  </span>
                </span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-sand-300 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </Link>
            ))}
          </nav>

          <div className="mt-10 space-y-4">
            <Link
              href={accountHref}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-3.5 text-sm font-semibold text-sand-50"
            >
              <User className="size-4" strokeWidth={2} aria-hidden="true" />
              {ready && user ? `Signed in as ${accountLabel}` : "Sign in"}
            </Link>
            <Link
              href="/inquire"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-sand-50 px-5 py-3.5 text-sm font-semibold text-ink"
            >
              Plan a visit
              <ArrowUpRight className="size-4" strokeWidth={2} />
            </Link>
            <p className="text-center text-[11px] tracking-[0.16em] text-sand-300/70 uppercase">
              {site.location}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
