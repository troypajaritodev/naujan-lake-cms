"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthField } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { AuthError } from "@/lib/auth";

type Field = "fullName" | "email" | "phone" | "password" | "confirmPassword";

const empty = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();

  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Partial<Record<Field | "terms", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  const set = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!accepted) {
      setErrors({ terms: "Please confirm you have read the park guidelines." });
      return;
    }

    setPending(true);
    try {
      await register(values);
      router.push("/account");
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
        id="fullName"
        label="Full name"
        value={values.fullName}
        onChange={set("fullName")}
        error={errors.fullName}
        placeholder="Juan Dela Cruz"
        autoComplete="name"
      />

      <div className="grid gap-5 sm:grid-cols-2">
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
          id="phone"
          label="Mobile"
          type="tel"
          value={values.phone}
          onChange={set("phone")}
          error={errors.phone}
          placeholder="+63 917 000 0000"
          autoComplete="tel"
          inputMode="tel"
          required={false}
        />
      </div>

      <AuthField
        id="password"
        label="Password"
        type={showPassword ? "text" : "password"}
        value={values.password}
        onChange={set("password")}
        error={errors.password}
        hint="At least 8 characters, with a letter and a number."
        autoComplete="new-password"
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

      <AuthField
        id="confirmPassword"
        label="Confirm password"
        type={showPassword ? "text" : "password"}
        value={values.confirmPassword}
        onChange={set("confirmPassword")}
        error={errors.confirmPassword}
        autoComplete="new-password"
      />

      <div>
        <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft/85">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => {
              setAccepted(event.target.checked);
              setErrors((current) => ({ ...current, terms: undefined }));
            }}
            className="mt-0.5 size-4 shrink-0 rounded border-ink/25 accent-lake-700"
          />
          <span>
            I have read the{" "}
            <a
              href="/guidelines"
              className="font-medium text-lake-700 underline decoration-lake-600/30 underline-offset-2 hover:text-lake-900"
            >
              park guidelines
            </a>{" "}
            and will follow the zoning and safety rules on the water.
          </span>
        </label>
        {errors.terms && (
          <p className="mt-1.5 text-[12px] text-alert-600">{errors.terms}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-lake-800 px-5 py-3.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-lake-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        ) : null}
        {pending ? "Creating account" : "Create account"}
        {!pending && (
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2}
          />
        )}
      </button>

      <p className="text-[11.5px] leading-relaxed text-sand-600">
        Accounts are stored in this browser for the demo build. Passwords are
        kept as a salted SHA-256 digest, never as plain text.
      </p>
    </form>
  );
}
