"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { AuthField } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { AuthError } from "@/lib/auth";

type Field = "email" | "password";

const DEMO = { email: "visitor@example.com", password: "Visitor123!" };

export default function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  // `?next=` is read once on mount; the value is never rendered, so it cannot
  // cause a hydration mismatch.
  const [next] = useState(() => {
    if (typeof window === "undefined") return "/account";
    const target = new URLSearchParams(window.location.search).get("next");
    return target && target.startsWith("/") ? target : "/account";
  });

  const set = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setPending(true);

    try {
      await signIn(values.email, values.password);
      router.push(next);
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

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div
          role="alert"
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
    </form>
  );
}
