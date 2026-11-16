import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AccountView from "@/components/account/account-view";
import { getServerSession } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Your account",
  description:
    "Manage your Naujan Lake National Park visitor profile, password and tour inquiries.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

async function AccountAccessGate() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?next=/account");
  }
  return <AccountView />;
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountAccessGate />
    </Suspense>
  );
}
