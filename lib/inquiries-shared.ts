import { cleanText } from "@/lib/sanitize";

export type InquiryStatus =
  | "PENDING"
  | "ON_PROCESS"
  | "CONTACTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";

/** Who last moved an inquiry — the park through the queue, or the visitor. */
export type InquiryActor = "visitor" | "park";

export type PaymentMethod = "GCASH" | "MAYA" | "BANK_TRANSFER" | "ON_SITE_CASH";

export type PaymentStatus =
  | "UNPAID"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REFUNDED";

export type InquiryTimelineEntry = {
  id: string;
  status: InquiryStatus | "PAYMENT_SUBMITTED" | "PAYMENT_VERIFIED" | "NOTE_UPDATED";
  label: string;
  note?: string;
  at: string;
  actor: InquiryActor;
};

export type InquiryMessage = {
  id: string;
  sender: InquiryActor;
  senderName: string;
  body: string;
  at: string;
};

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
  updatedAt?: string;
  onProcessAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  decidedBy?: InquiryActor;
  ratePerPerson?: number;
  packageSubtotal?: number;
  facilitationFee?: number;
  operatorCommission?: number;
  platformRevenue?: number;
  totalAmount?: number;
  firstPaymentRate?: number;
  firstPaymentAmount?: number;
  balanceAmount?: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  paymentAccountName?: string;
  paymentProofUrl?: string;
  paymentStatus?: PaymentStatus;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  adminNote?: string;
  timeline?: InquiryTimelineEntry[];
  messages?: InquiryMessage[];
};

export type InquiryInput = Omit<
  Inquiry,
  "id" | "reference" | "status" | "createdAt" | "timeline" | "paymentSubmittedAt"
>;

export type FirstPaymentSubmission = {
  paymentMethod: PaymentMethod;
  paymentReference: string;
  paymentAccountName: string;
  firstPaymentRate: number;
  firstPaymentAmount: number;
  totalAmount: number;
  ratePerPerson: number;
  paymentProofUrl?: string;
};

export const MAX_PARTY_SIZE = 60;
export const FACILITATION_FEE_PHP = 150;
export const OPERATOR_COMMISSION_RATE = 0.08;
export const VARIABLE_COST_PER_BOOKING_PHP = 72;

export type BookingPricingBreakdown = {
  ratePerPerson: number;
  partySize: number;
  packageSubtotal: number;
  facilitationFee: number;
  totalAmount: number;
  operatorCommission: number;
  operatorNetPayout: number;
  platformRevenue: number;
};

export type BookingEconomics = {
  packageSubtotal: number;
  facilitationFee: number;
  operatorCommission: number;
  operatorNetPayout: number;
  platformRevenue: number;
  estimatedVariableCost: number;
  platformContribution: number;
};

export type PortfolioEconomicsSummary = {
  realizedCount: number;
  pendingCount: number;
  excludedCount: number;
  grossBookingValue: number;
  operatorGrossTariffs: number;
  facilitationFees: number;
  operatorCommissions: number;
  operatorNetPayout: number;
  platformRevenue: number;
  estimatedVariableCosts: number;
  netPlatformContribution: number;
  contributionMarginPct: number;
  pendingPlatformRevenue: number;
  byPackage: Array<{
    slug: string;
    title: string;
    bookings: number;
    guests: number;
    grossTariff: number;
    facilitationFees: number;
    operatorCommission: number;
    platformRevenue: number;
  }>;
};

const phpWholeFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const phpPreciseFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a PHP currency amount cleanly, showing centavos only when non-zero. */
export function formatPhpAmount(amount: number): string {
  return Number.isInteger(amount)
    ? phpWholeFormatter.format(amount)
    : phpPreciseFormatter.format(amount);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeOperatorCommission(packageSubtotal: number): number {
  return roundCurrency(Math.max(0, packageSubtotal) * OPERATOR_COMMISSION_RATE);
}

export function computeBookingPricing(
  ratePerPerson: number,
  partySize: number,
  facilitationFee = FACILITATION_FEE_PHP,
): BookingPricingBreakdown {
  const safeRate = Math.max(0, ratePerPerson);
  const safeParty = Math.max(1, Math.trunc(partySize));
  const safeFee = Math.max(0, facilitationFee);
  const packageSubtotal = roundCurrency(safeRate * safeParty);
  const totalAmount = roundCurrency(packageSubtotal + safeFee);
  const operatorCommission = computeOperatorCommission(packageSubtotal);
  const operatorNetPayout = roundCurrency(
    Math.max(0, packageSubtotal - operatorCommission),
  );
  const platformRevenue = roundCurrency(safeFee + operatorCommission);

  return {
    ratePerPerson: safeRate,
    partySize: safeParty,
    packageSubtotal,
    facilitationFee: safeFee,
    totalAmount,
    operatorCommission,
    operatorNetPayout,
    platformRevenue,
  };
}

export function getBookingEconomics(inquiry: Inquiry): BookingEconomics {
  const hydrated = hydrateInquiry(inquiry);
  const packageSubtotal =
    hydrated.packageSubtotal ??
    roundCurrency((hydrated.ratePerPerson ?? 0) * hydrated.partySize);
  const facilitationFee = hydrated.facilitationFee ?? 0;
  const operatorCommission =
    hydrated.operatorCommission ?? computeOperatorCommission(packageSubtotal);
  const platformRevenue =
    hydrated.platformRevenue ?? roundCurrency(facilitationFee + operatorCommission);
  const operatorNetPayout = roundCurrency(
    Math.max(0, packageSubtotal - operatorCommission),
  );
  const estimatedVariableCost = VARIABLE_COST_PER_BOOKING_PHP;
  const platformContribution = roundCurrency(
    platformRevenue - estimatedVariableCost,
  );

  return {
    packageSubtotal,
    facilitationFee,
    operatorCommission,
    operatorNetPayout,
    platformRevenue,
    estimatedVariableCost,
    platformContribution,
  };
}

export function isRealizedRevenueBooking(inquiry: Inquiry): boolean {
  if (
    inquiry.status === "DECLINED" ||
    inquiry.status === "CANCELLED" ||
    inquiry.paymentStatus === "REFUNDED"
  ) {
    return false;
  }
  return (
    inquiry.status === "ON_PROCESS" ||
    inquiry.status === "CONFIRMED" ||
    inquiry.status === "COMPLETED" ||
    inquiry.paymentStatus === "VERIFIED"
  );
}

export function summarizePortfolioEconomics(
  inquiries: readonly Inquiry[],
): PortfolioEconomicsSummary {
  let realizedCount = 0;
  let pendingCount = 0;
  let excludedCount = 0;
  let grossBookingValue = 0;
  let operatorGrossTariffs = 0;
  let facilitationFees = 0;
  let operatorCommissions = 0;
  let pendingPlatformRevenue = 0;

  const packageGroups = new Map<
    string,
    {
      slug: string;
      title: string;
      bookings: number;
      guests: number;
      grossTariff: number;
      facilitationFees: number;
      operatorCommission: number;
      platformRevenue: number;
    }
  >();

  for (const raw of inquiries) {
    const econ = getBookingEconomics(raw);

    if (
      raw.status === "DECLINED" ||
      raw.status === "CANCELLED" ||
      raw.paymentStatus === "REFUNDED"
    ) {
      excludedCount += 1;
      continue;
    }

    if (isRealizedRevenueBooking(raw)) {
      realizedCount += 1;
      grossBookingValue += econ.packageSubtotal + econ.facilitationFee;
      operatorGrossTariffs += econ.packageSubtotal;
      facilitationFees += econ.facilitationFee;
      operatorCommissions += econ.operatorCommission;

      const key = raw.tourSlug || raw.tourTitle;
      const existing = packageGroups.get(key) ?? {
        slug: raw.tourSlug,
        title: raw.tourTitle,
        bookings: 0,
        guests: 0,
        grossTariff: 0,
        facilitationFees: 0,
        operatorCommission: 0,
        platformRevenue: 0,
      };
      existing.bookings += 1;
      existing.guests += raw.partySize;
      existing.grossTariff = roundCurrency(
        existing.grossTariff + econ.packageSubtotal,
      );
      existing.facilitationFees = roundCurrency(
        existing.facilitationFees + econ.facilitationFee,
      );
      existing.operatorCommission = roundCurrency(
        existing.operatorCommission + econ.operatorCommission,
      );
      existing.platformRevenue = roundCurrency(
        existing.platformRevenue + econ.platformRevenue,
      );
      packageGroups.set(key, existing);
    } else {
      pendingCount += 1;
      pendingPlatformRevenue += econ.platformRevenue;
    }
  }

  grossBookingValue = roundCurrency(grossBookingValue);
  operatorGrossTariffs = roundCurrency(operatorGrossTariffs);
  facilitationFees = roundCurrency(facilitationFees);
  operatorCommissions = roundCurrency(operatorCommissions);
  const operatorNetPayout = roundCurrency(
    Math.max(0, operatorGrossTariffs - operatorCommissions),
  );
  const platformRevenue = roundCurrency(facilitationFees + operatorCommissions);
  const estimatedVariableCosts = realizedCount * VARIABLE_COST_PER_BOOKING_PHP;
  const netPlatformContribution = roundCurrency(
    platformRevenue - estimatedVariableCosts,
  );
  const contributionMarginPct =
    platformRevenue > 0
      ? Math.round((netPlatformContribution / platformRevenue) * 1000) / 10
      : 0;

  return {
    realizedCount,
    pendingCount,
    excludedCount,
    grossBookingValue,
    operatorGrossTariffs,
    facilitationFees,
    operatorCommissions,
    operatorNetPayout,
    platformRevenue,
    estimatedVariableCosts,
    netPlatformContribution,
    contributionMarginPct,
    pendingPlatformRevenue: roundCurrency(pendingPlatformRevenue),
    byPackage: [...packageGroups.values()].sort(
      (a, b) => b.platformRevenue - a.platformRevenue,
    ),
  };
}

/** Thrown for guard failures the UI should phrase to a person, not a dev. */
export class InquiryError extends Error {}

export const CANCELLABLE_STATUSES: readonly InquiryStatus[] = [
  "PENDING",
  "ON_PROCESS",
  "CONTACTED",
  "CONFIRMED",
];

export const BOARDABLE_STATUSES: readonly InquiryStatus[] = [
  "ON_PROCESS",
  "CONFIRMED",
  "COMPLETED",
];

export function canCancelInquiry(
  inquiry: Pick<Inquiry, "status">,
): boolean {
  return CANCELLABLE_STATUSES.includes(inquiry.status);
}

/** True once the request has reached a final or ready decision. */
export function isDecidedStatus(status: InquiryStatus): boolean {
  return (
    status === "CONFIRMED" ||
    status === "COMPLETED" ||
    status === "DECLINED" ||
    status === "CANCELLED"
  );
}

export function isBoardableStatus(status: InquiryStatus): boolean {
  return BOARDABLE_STATUSES.includes(status);
}

export function slotKey(tourSlug: string, preferredDate: string): string {
  return `${tourSlug}::${preferredDate}`;
}

/** Total seats held on a tour + departure date across active bookings. */
export function getReservedSeatsForDate(
  inquiries: readonly Inquiry[],
  tourSlug: string,
  preferredDate: string,
  excludeId?: string,
): number {
  if (!tourSlug || !preferredDate) return 0;
  return inquiries.reduce((sum, entry) => {
    if (entry.id === excludeId) return sum;
    if (entry.tourSlug !== tourSlug || entry.preferredDate !== preferredDate) {
      return sum;
    }
    if (!CANCELLABLE_STATUSES.includes(entry.status)) return sum;
    return sum + Math.max(0, entry.partySize);
  }, 0);
}

/** Aggregate reserved seat counts keyed by `tourSlug::preferredDate`. */
export function computeReservedBySlot(
  inquiries: readonly Inquiry[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of inquiries) {
    if (!entry.tourSlug || !entry.preferredDate) continue;
    if (!CANCELLABLE_STATUSES.includes(entry.status)) continue;
    const key = slotKey(entry.tourSlug, entry.preferredDate);
    counts[key] = (counts[key] ?? 0) + Math.max(0, entry.partySize);
  }
  return counts;
}

/** Fallback per-person rates matching seed tours for legacy records. */
export const FALLBACK_TOUR_RATES: Record<string, number> = {
  "guided-birdwatching-expedition": 1850,
  "sunrise-boat-tour": 1200,
  "lakeside-community-homestay": 2400,
  "educational-research-trek": 1500,
};

export const SEED_INQUIRIES: Inquiry[] = [
  {
    id: "inq_seed_1",
    reference: "NL-2026-104882",
    userEmail: "visitor@example.com",
    fullName: "Demo Visitor",
    email: "visitor@example.com",
    phone: "+63 917 000 0002",
    tourSlug: "sunrise-boat-tour",
    tourTitle: "Sunrise boat tour",
    preferredDate: "2026-11-24",
    partySize: 2,
    message: "Coming from Calapan, can we leave a motorbike at the jetty?",
    status: "PENDING",
    createdAt: "2026-11-14T09:12:00.000Z",
    ratePerPerson: 1200,
    packageSubtotal: 2400,
    facilitationFee: 150,
    operatorCommission: 192,
    platformRevenue: 342,
    totalAmount: 2550,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 1275,
    balanceAmount: 1275,
    paymentMethod: "GCASH",
    paymentReference: "GC-884120934",
    paymentAccountName: "Demo Visitor",
    paymentStatus: "PENDING_VERIFICATION",
    paymentSubmittedAt: "2026-11-14T09:12:00.000Z",
    timeline: [
      {
        id: "tl_seed_1_1",
        status: "PENDING",
        label: "Booking & first payment submitted",
        note: "50% first payment (PHP 1,275) via GCash · Ref GC-884120934",
        at: "2026-11-14T09:12:00.000Z",
        actor: "visitor",
      },
    ],
  },
  {
    id: "inq_seed_5",
    reference: "NL-2026-104210",
    userEmail: "visitor@example.com",
    fullName: "Demo Visitor",
    email: "visitor@example.com",
    phone: "+63 917 000 0002",
    tourSlug: "guided-birdwatching-expedition",
    tourTitle: "Guided birdwatching expedition",
    preferredDate: "2026-11-28",
    partySize: 3,
    message: "We would love an early marsh run if the weather holds.",
    status: "ON_PROCESS",
    createdAt: "2026-11-10T06:30:00.000Z",
    updatedAt: "2026-11-11T02:15:00.000Z",
    onProcessAt: "2026-11-11T02:15:00.000Z",
    decidedBy: "park",
    ratePerPerson: 1850,
    packageSubtotal: 5550,
    facilitationFee: 150,
    operatorCommission: 444,
    platformRevenue: 594,
    totalAmount: 5700,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 2850,
    balanceAmount: 2850,
    paymentMethod: "MAYA",
    paymentReference: "MY-552019481",
    paymentAccountName: "Demo Visitor",
    paymentStatus: "VERIFIED",
    paymentSubmittedAt: "2026-11-10T06:30:00.000Z",
    paymentVerifiedAt: "2026-11-11T02:15:00.000Z",
    adminNote:
      "First payment verified. Boat #2 and Licensed Spotter Marco are currently being scheduled.",
    timeline: [
      {
        id: "tl_seed_5_1",
        status: "PENDING",
        label: "Booking & first payment submitted",
        note: "50% first payment (PHP 2,850) via Maya · Ref MY-552019481",
        at: "2026-11-10T06:30:00.000Z",
        actor: "visitor",
      },
      {
        id: "tl_seed_5_2",
        status: "PAYMENT_VERIFIED",
        label: "First payment verified",
        note: "Confirmed PHP 2,850 deposit received via Maya.",
        at: "2026-11-11T02:15:00.000Z",
        actor: "park",
      },
      {
        id: "tl_seed_5_3",
        status: "ON_PROCESS",
        label: "Accepted · On Process",
        note: "Boat #2 and Licensed Spotter Marco are currently being scheduled.",
        at: "2026-11-11T02:15:00.000Z",
        actor: "park",
      },
    ],
    messages: [
      {
        id: "msg_seed_5_1",
        sender: "visitor",
        senderName: "Demo Visitor",
        body: "Hi! Do we need to bring our own rubber boots if the marsh trail is damp?",
        at: "2026-11-10T07:05:00.000Z",
      },
      {
        id: "msg_seed_5_2",
        sender: "park",
        senderName: "Park Ranger Desk",
        body: "Good morning! We have accepted your booking and verified your PHP 2,850 deposit. Water shoes or strapped sandals are great for the jetty boarding — boatmen will provide dry bags too.",
        at: "2026-11-11T02:18:00.000Z",
      },
    ],
  },
  {
    id: "inq_seed_2",
    reference: "NL-2026-103417",
    userEmail: "ana.reyes@example.com",
    fullName: "Ana Reyes",
    email: "ana.reyes@example.com",
    phone: "+63 918 442 1180",
    tourSlug: "guided-birdwatching-expedition",
    tourTitle: "Guided birdwatching expedition",
    preferredDate: "2026-11-21",
    partySize: 4,
    message: "Two of us have binoculars already.",
    status: "CONFIRMED",
    createdAt: "2026-11-02T07:40:00.000Z",
    updatedAt: "2026-11-03T02:10:00.000Z",
    onProcessAt: "2026-11-02T11:00:00.000Z",
    confirmedAt: "2026-11-03T02:10:00.000Z",
    decidedBy: "park",
    ratePerPerson: 1850,
    packageSubtotal: 7400,
    facilitationFee: 150,
    operatorCommission: 592,
    platformRevenue: 742,
    totalAmount: 7550,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 3775,
    balanceAmount: 3775,
    paymentMethod: "GCASH",
    paymentReference: "GC-771024881",
    paymentAccountName: "Ana Reyes",
    paymentStatus: "VERIFIED",
    paymentSubmittedAt: "2026-11-02T07:40:00.000Z",
    paymentVerifiedAt: "2026-11-02T11:00:00.000Z",
    adminNote: "Cleared for 05:30 jetty departure. Remaining balance due on arrival.",
    timeline: [
      {
        id: "tl_seed_2_1",
        status: "PENDING",
        label: "Booking & first payment submitted",
        note: "50% first payment (PHP 3,775) via GCash · Ref GC-771024881",
        at: "2026-11-02T07:40:00.000Z",
        actor: "visitor",
      },
      {
        id: "tl_seed_2_2",
        status: "ON_PROCESS",
        label: "Accepted · On Process",
        note: "First payment verified and boat assignment started.",
        at: "2026-11-02T11:00:00.000Z",
        actor: "park",
      },
      {
        id: "tl_seed_2_3",
        status: "CONFIRMED",
        label: "Confirmed for departure",
        note: "Cleared for 05:30 jetty departure. Remaining balance due on arrival.",
        at: "2026-11-03T02:10:00.000Z",
        actor: "park",
      },
    ],
  },
  {
    id: "inq_seed_3",
    reference: "NL-2026-101905",
    userEmail: "carlo.mendoza@example.com",
    fullName: "Carlo Mendoza",
    email: "carlo.mendoza@example.com",
    phone: "+63 920 118 7743",
    tourSlug: "lakeside-community-homestay",
    tourTitle: "Lakeside community homestay",
    preferredDate: "2026-10-25",
    partySize: 3,
    message: "",
    status: "COMPLETED",
    createdAt: "2026-10-18T15:05:00.000Z",
    updatedAt: "2026-10-26T10:00:00.000Z",
    onProcessAt: "2026-10-19T01:00:00.000Z",
    confirmedAt: "2026-10-19T08:22:00.000Z",
    completedAt: "2026-10-26T10:00:00.000Z",
    decidedBy: "park",
    ratePerPerson: 2400,
    packageSubtotal: 7200,
    facilitationFee: 150,
    operatorCommission: 576,
    platformRevenue: 726,
    totalAmount: 7350,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 3675,
    balanceAmount: 3675,
    paymentMethod: "BANK_TRANSFER",
    paymentReference: "LBP-9902145",
    paymentAccountName: "Carlo Mendoza",
    paymentStatus: "VERIFIED",
    paymentSubmittedAt: "2026-10-18T15:05:00.000Z",
    paymentVerifiedAt: "2026-10-19T01:00:00.000Z",
    adminNote: "Homestay completed with Barangay Bayani host family.",
  },
  {
    id: "inq_seed_4",
    reference: "NL-2026-100233",
    userEmail: "liza.bautista@example.com",
    fullName: "Liza Bautista",
    email: "liza.bautista@example.com",
    phone: "+63 915 903 2214",
    tourSlug: "educational-research-trek",
    tourTitle: "Educational research trek",
    preferredDate: "2026-10-11",
    partySize: 12,
    message: "Grade 11 field class, two teachers accompanying.",
    status: "DECLINED",
    createdAt: "2026-10-04T11:20:00.000Z",
    updatedAt: "2026-10-05T04:00:00.000Z",
    decidedBy: "park",
    ratePerPerson: 1500,
    packageSubtotal: 18000,
    facilitationFee: 150,
    operatorCommission: 1440,
    platformRevenue: 1590,
    totalAmount: 18150,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 9075,
    balanceAmount: 9075,
    paymentMethod: "BANK_TRANSFER",
    paymentReference: "LBP-8834120",
    paymentAccountName: "Liza Bautista",
    paymentStatus: "REFUNDED",
    paymentSubmittedAt: "2026-10-04T11:20:00.000Z",
    adminNote: "Trail bridge closed for repair on requested date. Deposit refunded.",
  },
];

function buildFallbackTimeline(raw: Inquiry): InquiryTimelineEntry[] {
  const entries: InquiryTimelineEntry[] = [
    {
      id: `tl_${raw.id}_created`,
      status: "PENDING",
      label: "Booking request submitted",
      at: raw.createdAt,
      actor: "visitor",
    },
  ];

  if (raw.onProcessAt) {
    entries.push({
      id: `tl_${raw.id}_process`,
      status: "ON_PROCESS",
      label: "Accepted · On Process",
      at: raw.onProcessAt,
      actor: "park",
    });
  }
  if (raw.confirmedAt) {
    entries.push({
      id: `tl_${raw.id}_confirmed`,
      status: "CONFIRMED",
      label: "Confirmed by the park office",
      at: raw.confirmedAt,
      actor: "park",
    });
  }
  if (raw.completedAt) {
    entries.push({
      id: `tl_${raw.id}_completed`,
      status: "COMPLETED",
      label: "Trip completed",
      at: raw.completedAt,
      actor: "park",
    });
  }
  if (raw.cancelledAt) {
    entries.push({
      id: `tl_${raw.id}_cancelled`,
      status: "CANCELLED",
      label:
        raw.decidedBy === "visitor"
          ? "Withdrawn by visitor"
          : "Cancelled by park office",
      at: raw.cancelledAt,
      actor: raw.decidedBy ?? "visitor",
    });
  } else if (raw.status !== "PENDING" && entries.length === 1 && raw.updatedAt) {
    entries.push({
      id: `tl_${raw.id}_updated`,
      status: raw.status,
      label: `Marked ${raw.status.toLowerCase().replace("_", " ")}`,
      at: raw.updatedAt,
      actor: raw.decidedBy ?? "park",
    });
  }

  return entries;
}

export function hydrateInquiry(raw: Inquiry): Inquiry {
  const rate =
    typeof raw.ratePerPerson === "number" && raw.ratePerPerson >= 0
      ? raw.ratePerPerson
      : (FALLBACK_TOUR_RATES[raw.tourSlug] ?? 0);
  const packageSubtotal =
    typeof raw.packageSubtotal === "number" && raw.packageSubtotal >= 0
      ? raw.packageSubtotal
      : roundCurrency(rate * raw.partySize);
  const facilitationFee =
    typeof raw.facilitationFee === "number" && raw.facilitationFee >= 0
      ? raw.facilitationFee
      : typeof raw.totalAmount === "number" && raw.totalAmount > packageSubtotal
        ? roundCurrency(raw.totalAmount - packageSubtotal)
        : 0;
  const total =
    typeof raw.totalAmount === "number" && raw.totalAmount >= 0
      ? raw.totalAmount
      : roundCurrency(packageSubtotal + facilitationFee);
  const operatorCommission =
    typeof raw.operatorCommission === "number" && raw.operatorCommission >= 0
      ? raw.operatorCommission
      : computeOperatorCommission(packageSubtotal);
  const platformRevenue =
    typeof raw.platformRevenue === "number" && raw.platformRevenue >= 0
      ? raw.platformRevenue
      : roundCurrency(facilitationFee + operatorCommission);
  const firstPaymentAmount =
    typeof raw.firstPaymentAmount === "number" && raw.firstPaymentAmount >= 0
      ? raw.firstPaymentAmount
      : 0;
  const balanceAmount =
    typeof raw.balanceAmount === "number" && raw.balanceAmount >= 0
      ? raw.balanceAmount
      : Math.max(0, total - firstPaymentAmount);

  const paymentStatus: PaymentStatus =
    raw.paymentStatus ??
    (firstPaymentAmount > 0 && raw.paymentReference
      ? raw.status === "CONFIRMED" ||
        raw.status === "ON_PROCESS" ||
        raw.status === "COMPLETED"
        ? "VERIFIED"
        : "PENDING_VERIFICATION"
      : "UNPAID");

  const timeline =
    Array.isArray(raw.timeline) && raw.timeline.length > 0
      ? raw.timeline
      : buildFallbackTimeline(raw);

  return {
    ...raw,
    ratePerPerson: rate,
    packageSubtotal,
    facilitationFee,
    operatorCommission,
    platformRevenue,
    totalAmount: total,
    firstPaymentRate:
      raw.firstPaymentRate ??
      (total > 0 && firstPaymentAmount > 0
        ? Math.round((firstPaymentAmount / total) * 100) / 100
        : 0.5),
    firstPaymentAmount,
    balanceAmount,
    paymentStatus,
    timeline,
    messages: Array.isArray(raw.messages) ? raw.messages : [],
  };
}

export function statusTimelineLabel(
  status: InquiryStatus,
  actor: InquiryActor,
): string {
  switch (status) {
    case "PENDING":
      return "Moved back to Pending";
    case "ON_PROCESS":
      return "Accepted · On Process";
    case "CONTACTED":
      return "Contacted by park office";
    case "CONFIRMED":
      return "Confirmed for departure";
    case "COMPLETED":
      return "Trip completed";
    case "DECLINED":
      return "Declined by park office";
    case "CANCELLED":
      return actor === "visitor"
        ? "Withdrawn by visitor"
        : "Cancelled by park office";
  }
}

export function stampInquiryStatus(
  inquiry: Inquiry,
  status: InquiryStatus,
  at: string,
  actor: InquiryActor,
  options?: { note?: string; paymentStatus?: PaymentStatus },
): Inquiry {
  const hydrated = hydrateInquiry(inquiry);
  const cleanNote =
    options?.note !== undefined ? cleanText(options.note, 500) : undefined;

  const next: Inquiry = {
    ...hydrated,
    status,
    updatedAt: at,
    decidedBy: actor,
    ...(cleanNote !== undefined ? { adminNote: cleanNote } : {}),
  };

  if (options?.paymentStatus) {
    next.paymentStatus = options.paymentStatus;
    if (options.paymentStatus === "VERIFIED" && !next.paymentVerifiedAt) {
      next.paymentVerifiedAt = at;
    }
  }

  if (status === "ON_PROCESS") {
    next.onProcessAt = hydrated.onProcessAt ?? at;
    delete next.confirmedAt;
    delete next.completedAt;
    delete next.cancelledAt;
  } else if (status === "CONFIRMED") {
    next.onProcessAt = hydrated.onProcessAt ?? at;
    next.confirmedAt = at;
    delete next.completedAt;
    delete next.cancelledAt;
  } else if (status === "COMPLETED") {
    next.onProcessAt = hydrated.onProcessAt ?? at;
    next.confirmedAt = hydrated.confirmedAt ?? at;
    next.completedAt = at;
    delete next.cancelledAt;
  } else if (status === "CANCELLED") {
    next.cancelledAt = at;
    delete next.confirmedAt;
    delete next.completedAt;
  } else {
    delete next.confirmedAt;
    delete next.completedAt;
    delete next.cancelledAt;
    if (status === "PENDING") {
      delete next.onProcessAt;
    }
  }

  const timeline = [...(hydrated.timeline ?? [])];
  timeline.push({
    id: `tl_${crypto.randomUUID().slice(0, 8)}`,
    status,
    label: statusTimelineLabel(status, actor),
    ...(cleanNote ? { note: cleanNote } : {}),
    at,
    actor,
  });
  next.timeline = timeline;

  return next;
}
