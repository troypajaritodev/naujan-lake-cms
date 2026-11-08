import type { Metadata } from "next";
import AccountView from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "Your account",
  description:
    "Manage your Naujan Lake National Park visitor profile, password and tour inquiries.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountView />;
}
