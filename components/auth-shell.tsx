"use client";

import Link from "next/link";
import { ArrowLeft, Leaf, ShieldCheck, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import BrandMark from "@/components/brand-mark";
import { site } from "@/lib/site";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

const perks = [
  {
    icon: Ticket,
    title: "One-touch inquiries",
    body: "Your name and email are filled in for every booking request.",
  },
  {
    icon: Leaf,
    title: "Keep a trip record",
    body: "Every inquiry you send stays listed under your account.",
  },
  {
    icon: ShieldCheck,
    title: "Park-office only",
    body: "No card details are collected here — fees settle on site.",
  },
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <section className="bg-sand-50 pt-28 pb-16 lg:pt-36 lg:pb-24">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-[12.5px] font-medium text-sand-700 transition-colors hover:text-ink"
        >
          <ArrowLeft
            className="size-3.5 transition-transform duration-300 group-hover:-translate-x-1"
            strokeWidth={2}
          />
          Back to the visitor hub
        </Link>

        <div className="mt-8 grid overflow-hidden rounded-3xl ring-1 ring-ink/10 lg:grid-cols-12">
          {/* Context panel */}
          <div className="relative isolate overflow-hidden bg-lake-950 px-7 py-10 sm:px-10 lg:col-span-5 lg:py-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_20%_0%,rgba(51,135,133,0.35),transparent_65%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full border border-white/8"
            />

            <div className="relative">
              <div className="flex items-center gap-3">
                <BrandMark className="size-10 bg-white/10 backdrop-blur-md" />
                <span className="text-[10px] font-medium tracking-[0.26em] text-sand-300/80 uppercase">
                  Visitor account
                </span>
              </div>

              <h2 className="mt-8 font-display text-[clamp(1.6rem,2.6vw,2.1rem)] leading-[1.12] font-light text-sand-50">
                {eyebrow}
              </h2>
              <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-sand-200/70">
                {site.tagline} — accounts are for visitors planning a trip, not
                for park staff.
              </p>

              <ul className="mt-9 space-y-5">
                {perks.map((perk) => (
                  <li key={perk.title} className="flex gap-3">
                    <perk.icon
                      className="mt-0.5 size-4 shrink-0 text-reed-300"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-sand-100">
                        {perk.title}
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-sand-300/65">
                        {perk.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form panel */}
          <div className="bg-white px-6 py-10 sm:px-10 lg:col-span-7 lg:px-14 lg:py-14">
            <h1 className="font-display text-[clamp(1.7rem,3vw,2.2rem)] leading-tight font-light text-ink">
              {title}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft/75">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>

            <div className="mt-8 border-t border-ink/8 pt-5 text-[13px] text-ink-soft/75">
              {footer}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "tel" | "password" | "date" | "number";
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  trailing?: ReactNode;
  required?: boolean;
  min?: number | string;
  max?: number | string;
};

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  hint,
  placeholder,
  autoComplete,
  inputMode,
  trailing,
  required = true,
  min,
  max,
}: AuthFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase"
      >
        {label}
        {!required && (
          <span className="ml-1.5 font-normal tracking-normal text-sand-500 normal-case">
            optional
          </span>
        )}
      </label>

      <div className="relative mt-2">
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required={required}
          min={min}
          max={max}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full rounded-xl border bg-white px-4 py-3 text-[14.5px] text-ink transition-colors outline-none placeholder:text-sand-400 focus:ring-3 ${
            trailing ? "pr-12" : ""
          } ${
            error
              ? "border-alert-500 focus:border-alert-500 focus:ring-alert-500/15"
              : "border-ink/12 focus:border-lake-600 focus:ring-lake-600/15"
          }`}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-1 flex items-center">
            {trailing}
          </div>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-alert-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-sand-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
