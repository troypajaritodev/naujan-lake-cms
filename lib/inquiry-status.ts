/**
 * Presentation metadata for inquiry & payment statuses, shared by the staff
 * queue and the visitor account so both screens describe the same state with
 * the same words and colours.
 */

import type {
  InquiryStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/inquiries";

export const INQUIRY_STATUS_ORDER: readonly InquiryStatus[] = [
  "PENDING",
  "ON_PROCESS",
  "CONTACTED",
  "CONFIRMED",
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
];

export const INQUIRY_STATUS_META: Record<
  InquiryStatus,
  { label: string; blurb: string; bar: string; chip: string }
> = {
  PENDING: {
    label: "Pending",
    blurb: "Awaiting admin acceptance & payment check",
    bar: "bg-reed-400",
    chip: "bg-reed-50 text-reed-800 ring-reed-600/25",
  },
  ON_PROCESS: {
    label: "On Process",
    blurb: "Accepted by admin · preparing boat, guide & permit",
    bar: "bg-lake-500",
    chip: "bg-lake-100 text-lake-800 ring-lake-600/30",
  },
  CONTACTED: {
    label: "Contacted",
    blurb: "The park office has replied",
    bar: "bg-lake-400",
    chip: "bg-lake-50 text-lake-700 ring-lake-600/25",
  },
  CONFIRMED: {
    label: "Confirmed",
    blurb: "Ready for departure",
    bar: "bg-moss-500",
    chip: "bg-moss-50 text-moss-700 ring-moss-600/25",
  },
  COMPLETED: {
    label: "Completed",
    blurb: "Trip finished",
    bar: "bg-moss-700",
    chip: "bg-moss-100 text-moss-800 ring-moss-700/25",
  },
  DECLINED: {
    label: "Declined",
    blurb: "Could not be accommodated",
    bar: "bg-alert-500",
    chip: "bg-alert-50 text-alert-700 ring-alert-500/25",
  },
  CANCELLED: {
    label: "Cancelled",
    blurb: "Withdrawn or cancelled",
    bar: "bg-sand-400",
    chip: "bg-sand-100 text-sand-700 ring-sand-500/30",
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; chip: string; hint: string }
> = {
  UNPAID: {
    label: "No deposit yet",
    chip: "bg-sand-100 text-sand-700 ring-sand-400/40",
    hint: "First payment has not been submitted yet.",
  },
  PENDING_VERIFICATION: {
    label: "First payment · For review",
    chip: "bg-reed-50 text-reed-800 ring-reed-600/25",
    hint: "Waiting for park staff to verify your reference number.",
  },
  VERIFIED: {
    label: "First payment · Verified",
    chip: "bg-moss-50 text-moss-700 ring-moss-600/25",
    hint: "Deposit confirmed by the park office.",
  },
  REFUNDED: {
    label: "Deposit refunded",
    chip: "bg-sand-100 text-sand-700 ring-sand-500/30",
    hint: "First payment returned.",
  },
};

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  {
    label: string;
    accountName: string;
    accountNumber: string;
    instructions: string;
  }
> = {
  GCASH: {
    label: "GCash",
    accountName: "Naujan Lake Protected Area Office",
    accountNumber: "0917 555 0142",
    instructions: "Send via GCash Express Send and enter the 9–13 digit reference number.",
  },
  MAYA: {
    label: "Maya",
    accountName: "Naujan Lake Eco-Tourism Fund",
    accountNumber: "0918 555 0198",
    instructions: "Send via Maya Wallet and copy the transaction reference ID.",
  },
  BANK_TRANSFER: {
    label: "Bank Transfer (LandBank)",
    accountName: "DENR PAMO Naujan Lake Trust",
    accountNumber: "0312-1048-92",
    instructions: "Transfer via InstaPay / PESONet and paste the bank trace or reference number.",
  },
  ON_SITE_CASH: {
    label: "Pay at Park Jetty (Cash)",
    accountName: "Naujan Lake Jetty Cashier",
    accountNumber: "Brgy. Bambanin Jetty Desk",
    instructions: "Reserve your slot now and pay the deposit or full tariff in cash at the park jetty upon check-in.",
  },
};

export const BOOKING_TRACKER_STEPS: readonly {
  status: InquiryStatus;
  title: string;
  subtitle: string;
}[] = [
  {
    status: "PENDING",
    title: "Pending",
    subtitle: "Booking & first payment sent",
  },
  {
    status: "ON_PROCESS",
    title: "On Process",
    subtitle: "Accepted · preparing boat & guide",
  },
  {
    status: "CONFIRMED",
    title: "Confirmed",
    subtitle: "Cleared for departure",
  },
  {
    status: "COMPLETED",
    title: "Completed",
    subtitle: "Visit finished",
  },
];

/** Returns the 0-based active step index in `BOOKING_TRACKER_STEPS` (or -1 if terminal). */
export function trackerStepIndex(status: InquiryStatus): number {
  switch (status) {
    case "PENDING":
    case "CONTACTED":
      return 0;
    case "ON_PROCESS":
      return 1;
    case "CONFIRMED":
      return 2;
    case "COMPLETED":
      return 3;
    default:
      return -1;
  }
}
