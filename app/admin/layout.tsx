import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import AdminShell from "@/components/admin/admin-shell";
import { getServerSession } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

async function AdminAccessGate({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?next=/admin");
  }
  if (session.role !== "admin") {
    redirect("/account");
  }
  return <AdminShell>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminAccessGate>{children}</AdminAccessGate>
    </Suspense>
  );
}
