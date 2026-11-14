/**
 * Presentation metadata for inquiry statuses, shared by the staff queue and
 * the visitor account so both screens describe the same state with the same
 * words and colours. Keeping it in one place is also what stops a new status
 * from compiling on the server but rendering as a blank chip in the UI.
 */

import type { InquiryStatus } from "@/lib/inquiries";

export const INQUIRY_STATUS_ORDER: readonly InquiryStatus[] = [
  "PENDING",
  "CONTACTED",
  "CONFIRMED",
  "DECLINED",
  "CANCELLED",
];

export const INQUIRY_STATUS_META: Record<
  InquiryStatus,
  { label: string; blurb: string; bar: string; chip: string }
> = {
  PENDING: {
    label: "Pending",
    blurb: "Waiting on the park office",
    bar: "bg-reed-400",
    chip: "bg-reed-50 text-reed-800 ring-reed-600/25",
  },
  CONTACTED: {
    label: "Contacted",
    blurb: "The park office has replied",
    bar: "bg-lake-400",
    chip: "bg-lake-50 text-lake-700 ring-lake-600/25",
  },
  CONFIRMED: {
    label: "Confirmed",
    blurb: "Accepted by the park office",
    bar: "bg-moss-500",
    chip: "bg-moss-50 text-moss-700 ring-moss-600/25",
  },
  DECLINED: {
    label: "Declined",
    blurb: "Could not be accommodated",
    bar: "bg-alert-500",
    chip: "bg-alert-50 text-alert-700 ring-alert-500/25",
  },
  CANCELLED: {
    label: "Cancelled",
    blurb: "Withdrawn by the visitor",
    bar: "bg-sand-400",
    chip: "bg-sand-100 text-sand-700 ring-sand-500/30",
  },
};
