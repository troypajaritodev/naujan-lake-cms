import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import RegisterForm from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Register as a visitor to Naujan Lake National Park — send tour inquiries, keep a record of your trips and manage your profile.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Plan the trip before you pack."
      title="Create your visitor account"
      subtitle="Two minutes now, and every inquiry after that is prefilled with your details."
      footer={
        <p>
          Already registered?{" "}
          <Link
            href="/login"
            className="font-semibold text-lake-700 underline decoration-lake-600/30 underline-offset-2 transition-colors hover:text-lake-900"
          >
            Sign in instead
          </Link>
          .
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
