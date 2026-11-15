"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
} from "lucide-react";
import { AuthField } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { AuthError } from "@/lib/auth";

type Field = "email" | "password";

const DEMO = { email: "visitor@example.com", password: "Visitor123!" };

export default function LoginForm() {
  const router = useRouter();
  const { signIn, ready, user } = useAuth();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  // Query flags are read once on mount; the values are never rendered on the
  // server, so they cannot cause a hydration mismatch.
  const [query] = useState(() => {
    if (typeof window === "undefined") {
      return { next: null as string | null, signedOut: false };
    }

    const params = new URLSearchParams(window.location.search);
    const target = params.get("next");
    return {
      next: target && target.startsWith("/") ? target : null,
      signedOut: params.get("signedOut") === "1",
    };
  });
  const { next, signedOut } = query;

  const set = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setPending(true);

    try {
      const signedIn = await signIn(values.email, values.password);
      // Staff land where the work is — the inquiry report that carries the
      // "new since your last visit" banner.
      router.replace(
        next ?? (signedIn.role === "admin" ? "/admin/inquiries" : "/account"),
      );
    } catch (error) {
      if (error instanceof AuthError && error.field) {
        setErrors({ [error.field]: error.message });
      } else {
        setFormError(
          error instanceof Error ? error.message : "Something went wrong. Try again.",
        );
      }
      setPending(false);
    }
  }

  // A signed-in visitor who opens /login by accident gets a way forward
  // instead of a second sign-in form.
  if (ready && user && !signedOut) {
    const destination = user.role === "admin" ? "/admin" : "/account";

    return (
      <div className="rounded-2xl bg-sand-50 p-6 ring-1 ring-ink/8">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-moss-700 uppercase">
          <CheckCircle2 className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
          Already signed in
        </p>
        <p className="mt-3 text-[15px] font-medium text-ink">
          {user.fullName}
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-soft/65">{user.email}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={destination}
            className="inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-2.5 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-lake-700"
          >
            {user.role === "admin" ? "Open the admin panel" : "Go to your account"}
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-ink/15 px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-white"
          >
            Back to the site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {signedOut && !formError && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl bg-moss-50 px-4 py-3 text-[13px] text-moss-800 ring-1 ring-moss-600/20 ring-inset"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
          You have been signed out. Sign in again whenever you are ready.
        </div>
      )}

      {formError && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl bg-alert-50 px-4 py-3 text-[13px] text-alert-700 ring-1 ring-alert-500/20 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {formError}
        </div>
      )}

      <AuthField
        id="email"
        label="Email"
        type="email"
        value={values.email}
        onChange={set("email")}
        error={errors.email}
        placeholder="you@example.com"
        autoComplete="email"
        inputMode="email"
      />

      <AuthField
        id="password"
        label="Password"
        type={showPassword ? "text" : "password"}
        value={values.password}
        onChange={set("password")}
        error={errors.password}
        autoComplete="current-password"
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="grid size-10 place-items-center rounded-lg text-sand-600 transition-colors hover:text-ink"
          >
            {showPassword ? (
              <EyeOff className="size-4" strokeWidth={1.8} />
            ) : (
              <Eye className="size-4" strokeWidth={1.8} />
            )}
          </button>
        }
      />

      <button
        type="submit"
        disabled={pending}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-lake-800 px-5 py-3.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-lake-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        ) : (
          <LogIn className="size-4" strokeWidth={2} />
        )}
        {pending ? "Signing in" : "Sign in"}
        {!pending && (
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2}
          />
        )}
      </button>

      {/* Seeded accounts only exist in the demo build. Never advertise them on
          a deployed site. */}
      {process.env.NODE_ENV !== "production" && (
        <div className="rounded-xl bg-sand-100/70 px-4 py-3.5 ring-1 ring-ink/8 ring-inset">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-700 uppercase">
            Demo account
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[12px] text-ink-soft">
              {DEMO.email} · {DEMO.password}
            </p>
            <button
              type="button"
              onClick={() => {
                setValues(DEMO);
                setErrors({});
              }}
              className="text-[12px] font-semibold text-lake-700 underline decoration-lake-600/30 underline-offset-2 hover:text-lake-900"
            >
              Fill it in
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
