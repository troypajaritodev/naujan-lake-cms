import type { Metadata } from "next";
import { connection } from "next/server";
import VerifyPassView from "@/components/verify/verify-pass-view";
import type { Inquiry, InquiryStatus, PaymentStatus } from "@/lib/inquiries-shared";
import { verifyPassToken, type PassTokenPayload } from "@/lib/pass-token";
import { getServerSession } from "@/lib/server-auth";
import { getServerInquiryByRef } from "@/lib/server-inquiries";

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

  const token = pick("token");
  const ref = pick("ref");

  let verifiedPass: PassTokenPayload | null = null;
  let tokenInvalid = false;

  if (token) {
    verifiedPass = await verifyPassToken(token);
    if (!verifiedPass) {
      tokenInvalid = true;
    }
  }

  const lookupRef = verifiedPass?.ref ?? ref;
  const [session, liveRecord] = await Promise.all([
    getServerSession(),
    lookupRef ? getServerInquiryByRef(lookupRef) : Promise.resolve(null),
  ]);

  let serverInquiry: Inquiry | null = null;
  let liveStatus: InquiryStatus | null = null;
  let livePaymentStatus: PaymentStatus | null = null;

  if (liveRecord) {
    if (verifiedPass) {
      liveStatus = liveRecord.status;
      livePaymentStatus = liveRecord.paymentStatus ?? null;
    }
    if (
      session &&
      (session.role === "admin" ||
        liveRecord.userEmail === session.email.toLowerCase())
    ) {
      serverInquiry = liveRecord;
    }
  }

  return (
    <VerifyPassView
      initialRef={lookupRef ?? ""}
      verifiedPass={verifiedPass}
      tokenInvalid={tokenInvalid}
      liveStatus={liveStatus}
      livePaymentStatus={livePaymentStatus}
      tokenLedgerMissing={Boolean(verifiedPass && !liveRecord)}
      serverInquiry={serverInquiry}
    />
  );
}
