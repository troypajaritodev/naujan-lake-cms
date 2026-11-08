import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Naujan Lake National Park visitor account to send tour inquiries and manage your profile.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="The lake keeps its own hours. Your details shouldn’t cost you any."
      title="Welcome back"
      subtitle="Sign in to send an inquiry or pick up where your last trip plan left off."
      footer={
        <p>
          New here?{" "}
          <Link
            href="/register"
            className="font-semibold text-lake-700 underline decoration-lake-600/30 underline-offset-2 transition-colors hover:text-lake-900"
          >
            Create a visitor account
          </Link>
          .
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
