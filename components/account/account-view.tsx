"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  LogOut,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { AuthField } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { AuthError, type SessionUser } from "@/lib/auth";
import { getInquiriesFor } from "@/lib/inquiries";

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
}

export default function AccountView() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/account");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <section className="grid min-h-[70svh] place-items-center bg-sand-50">
        <p className="flex items-center gap-2 text-[13px] text-sand-600">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          {ready ? "Taking you to sign in…" : "Loading your account…"}
        </p>
      </section>
    );
  }

  return <AccountDashboard user={user} />;
}

function AccountDashboard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { updateProfile, changePassword, signOut } = useAuth();

  // Seeded from props, so no effect is needed to keep the form in sync.
  const [profile, setProfile] = useState({
    fullName: user.fullName,
    phone: user.phone,
  });
  const [profileStatus, setProfileStatus] = useState<"idle" | "saved">("idle");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saved">("idle");
  const [passwordPending, setPasswordPending] = useState(false);

  const [inquiries] = useState(() => getInquiriesFor(user.email));

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileStatus("idle");

    try {
      updateProfile(profile);
      setProfileStatus("saved");
      window.setTimeout(() => setProfileStatus("idle"), 2600);
    } catch (error) {
      setProfileError(
        error instanceof AuthError ? error.message : "Could not save your profile.",
      );
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordStatus("idle");

    if (passwords.next !== passwords.confirm) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordPending(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordStatus("saved");
      window.setTimeout(() => setPasswordStatus("idle"), 2600);
    } catch (error) {
      setPasswordError(
        error instanceof AuthError ? error.message : "Could not change your password.",
      );
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <section className="bg-sand-50 pt-28 pb-20 lg:pt-36">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <p className="text-[11px] font-medium tracking-[0.22em] text-sand-600 uppercase">
          Visitor account
        </p>
        <h1 className="mt-3 font-display text-[clamp(1.9rem,4vw,2.8rem)] leading-tight font-light text-ink">
          Hello, {user.fullName.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-soft/75">
          {user.email} · member since {formatDate(user.createdAt)}
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Profile */}
            <form
              onSubmit={saveProfile}
              className="rounded-2xl bg-white p-6 ring-1 ring-ink/10 sm:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-[21px] leading-tight text-ink">
                  Profile details
                </h2>
                {profileStatus === "saved" && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-moss-700">
                    <Check className="size-3.5" strokeWidth={2.4} />
                    Saved
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-ink-soft/70">
                These details are prefilled into every tour inquiry you send.
              </p>

              <div className="mt-6 space-y-5">
                <AuthField
                  id="fullName"
                  label="Full name"
                  value={profile.fullName}
                  onChange={(fullName) =>
                    setProfile((current) => ({ ...current, fullName }))
                  }
                  autoComplete="name"
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="accountEmail"
                      className="block text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase"
                    >
                      Email
                    </label>
                    <input
                      id="accountEmail"
                      value={user.email}
                      readOnly
                      className="mt-2 w-full cursor-not-allowed rounded-xl border border-ink/10 bg-sand-100/70 px-4 py-3 text-[14.5px] text-ink-soft/70"
                    />
                    <p className="mt-1.5 text-[12px] text-sand-600">
                      The email is your sign-in ID and cannot be changed here.
                    </p>
                  </div>
                  <AuthField
                    id="phone"
                    label="Mobile"
                    type="tel"
                    value={profile.phone}
                    onChange={(phone) =>
                      setProfile((current) => ({ ...current, phone }))
                    }
                    autoComplete="tel"
                    inputMode="tel"
                    required={false}
                  />
                </div>
              </div>

              {profileError && (
                <p className="mt-4 flex items-center gap-2 text-[12.5px] text-alert-600">
                  <AlertCircle className="size-3.5" strokeWidth={2} />
                  {profileError}
                </p>
              )}

              <button
                type="submit"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-3 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-lake-700"
              >
                Save changes
                <ArrowRight className="size-4" strokeWidth={2} />
              </button>
            </form>

            {/* Password */}
            <form
              onSubmit={savePassword}
              className="rounded-2xl bg-white p-6 ring-1 ring-ink/10 sm:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-[21px] leading-tight text-ink">
                  Password
                </h2>
                {passwordStatus === "saved" && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-moss-700">
                    <Check className="size-3.5" strokeWidth={2.4} />
                    Password updated
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-ink-soft/70">
                The stored digest is replaced — nothing is ever saved in clear
                text.
              </p>

              <div className="mt-6 space-y-5">
                <AuthField
                  id="currentPassword"
                  label="Current password"
                  type="password"
                  value={passwords.current}
                  onChange={(current) =>
                    setPasswords((values) => ({ ...values, current }))
                  }
                  autoComplete="current-password"
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <AuthField
                    id="newPassword"
                    label="New password"
                    type="password"
                    value={passwords.next}
                    onChange={(next) =>
                      setPasswords((values) => ({ ...values, next }))
                    }
                    hint="8+ characters, with a letter and a number."
                    autoComplete="new-password"
                  />
                  <AuthField
                    id="confirmNewPassword"
                    label="Confirm new password"
                    type="password"
                    value={passwords.confirm}
                    onChange={(confirm) =>
                      setPasswords((values) => ({ ...values, confirm }))
                    }
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {passwordError && (
                <p className="mt-4 flex items-center gap-2 text-[12.5px] text-alert-600">
                  <AlertCircle className="size-3.5" strokeWidth={2} />
                  {passwordError}
                </p>
              )}

              <button
                type="submit"
                disabled={passwordPending}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-sand-100 disabled:opacity-60"
              >
                {passwordPending && (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                )}
                Update password
              </button>
            </form>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            {/* Session */}
            <div className="rounded-2xl bg-lake-950 p-6 text-sand-100">
              <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-sand-300/70 uppercase">
                <ShieldCheck className="size-3.5" strokeWidth={2} />
                Session
              </p>
              <p className="mt-4 font-display text-[22px] leading-tight text-sand-50">
                {user.role === "admin" ? "Park administrator" : "Visitor"}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-sand-300/70">
                {user.role === "admin"
                  ? "Full access to the content management panel."
                  : "Browse packages, send inquiries and manage your own profile."}
              </p>

              <button
                type="button"
                onClick={() => {
                  signOut();
                  router.push("/");
                }}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-white/15"
              >
                <LogOut className="size-4" strokeWidth={2} />
                Sign out
              </button>
            </div>

            {/* Inquiries */}
            <div className="rounded-2xl bg-white p-6 ring-1 ring-ink/10">
              <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-sand-700 uppercase">
                <Ticket className="size-3.5" strokeWidth={2} />
                Your inquiries
              </p>

              {inquiries.length === 0 ? (
                <p className="mt-3 text-[13px] leading-relaxed text-ink-soft/70">
                  Nothing sent yet. Pick a package and the form arrives
                  pre-filled with your details.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-ink/8">
                  {inquiries.slice(0, 4).map((inquiry) => (
                    <li key={inquiry.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-[13.5px] font-medium text-ink">
                        {inquiry.tourTitle}
                      </p>
                      <p className="mt-0.5 font-mono text-[11.5px] text-sand-600">
                        {inquiry.reference} · {formatDate(inquiry.preferredDate)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href="/inquire"
                className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-lake-700 transition-colors hover:text-lake-900"
              >
                Send an inquiry
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
