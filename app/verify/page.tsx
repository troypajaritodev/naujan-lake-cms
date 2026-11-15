import type { Metadata } from "next";
import { connection } from "next/server";
import VerifyPassView from "@/components/verify/verify-pass-view";

export const metadata: Metadata = {
  title: "Verify Boarding Pass",
  description:
    "Verify a Naujan Lake National Park booking reference and digital QR boarding pass at the park jetty.",
};

export const instant = false;

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;

  const pick = (key: string) => {
    const val = params[key];
    return typeof val === "string" ? val : undefined;
  };

  return (
    <VerifyPassView
      initial={{
        ref: pick("ref"),
        guest: pick("guest"),
        tour: pick("tour"),
        date: pick("date"),
        guests: pick("guests"),
        pay: pick("pay"),
      }}
    />
  );
}
