import type { Metadata } from "next";
import { connection } from "next/server";
import AdvisoryManager from "@/components/admin/advisory-manager";
import { listAdminAdvisoriesAction } from "@/lib/admin-advisory-actions";

export const metadata: Metadata = { title: "Advisories · Admin" };

export default async function AdminAdvisoriesPage() {
  // Ensure this page renders at request time before checking the admin session.
  await connection();

  const advisories = await listAdminAdvisoriesAction();

  return <AdvisoryManager initialAdvisories={advisories} />;
}
