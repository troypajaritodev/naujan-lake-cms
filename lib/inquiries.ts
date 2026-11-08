/**
 * Tour inquiries submitted from the visitor portal (Requirement B — customer
 * transactions). Stored in `localStorage` until the CMS/Supabase table exists.
 */

export type InquiryStatus = "PENDING" | "CONFIRMED" | "DECLINED";

export type Inquiry = {
  id: string;
  reference: string;
  userEmail: string;
  fullName: string;
  email: string;
  phone: string;
  tourSlug: string;
  tourTitle: string;
  preferredDate: string;
  partySize: number;
  message: string;
  status: InquiryStatus;
  createdAt: string;
};

export const INQUIRIES_KEY = "nl.inquiries.v1";

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

export function getInquiries(): Inquiry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(INQUIRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Inquiry[]) : [];
  } catch {
    return [];
  }
}

export function getInquiriesFor(email: string): Inquiry[] {
  const normalized = email.trim().toLowerCase();
  return getInquiries()
    .filter((inquiry) => inquiry.userEmail === normalized)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type InquiryInput = Omit<
  Inquiry,
  "id" | "reference" | "status" | "createdAt"
>;

export function createInquiry(input: InquiryInput): Inquiry {
  const now = new Date();
  const inquiry: Inquiry = {
    ...input,
    id: `inq_${crypto.randomUUID().slice(0, 8)}`,
    reference: `NL-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`,
    status: "PENDING",
    createdAt: now.toISOString(),
  };

  if (canUseStorage()) {
    window.localStorage.setItem(
      INQUIRIES_KEY,
      JSON.stringify([inquiry, ...getInquiries()]),
    );
  }

  return inquiry;
}
