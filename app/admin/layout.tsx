import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ReactNode } from "react";
import AdminShell from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

async function AdminRequestBoundary({ children }: { children: ReactNode }) {
  // Keep request-specific admin rendering out of the prerendered shell.
  await connection();
  return <AdminShell>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-svh place-items-center bg-sand-50">
          <p className="text-[13px] text-sand-600">Checking administrator access…</p>
        </div>
      }
    >
      <AdminRequestBoundary>{children}</AdminRequestBoundary>
    </Suspense>
  );
}
