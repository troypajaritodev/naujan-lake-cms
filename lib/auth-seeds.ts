export type Role = "admin" | "visitor";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  createdAt: string;
  isActive?: boolean;
  lastLoginAt?: string;
  address?: string;
  emergencyContact?: string;
};

export type StoredUser = SessionUser & { passwordHash: string };

/**
 * Seeded accounts so the portal can be demonstrated without a database.
 * Legacy seed hashes are `sha256(email + ":" + password)` and are upgraded to
 * salted `scrypt` hashes on first server sign-in.
 */
export const SEED_USERS: StoredUser[] = [
  {
    id: "usr_admin_seed",
    email: "admin@naujanlake.gov.ph",
    fullName: "Park Administrator",
    phone: "+63 917 000 0001",
    role: "admin",
    createdAt: "2026-01-05T08:00:00.000Z",
    passwordHash:
      "fc21fbec03dcacbf407b188a496f7a83e57acdac7eb7ebc387dcaaa046cbe66d",
  },
  {
    id: "usr_visitor_seed",
    email: "visitor@example.com",
    fullName: "Demo Visitor",
    phone: "+63 917 000 0002",
    role: "visitor",
    createdAt: "2026-02-11T08:00:00.000Z",
    passwordHash:
      "3f0dd34782ec47768171b8e1a8b1980df0cadc01c78e0ac12f510e48d1dd7400",
  },
  {
    id: "usr_ana_seed",
    email: "ana.reyes@example.com",
    fullName: "Ana Reyes",
    phone: "+63 918 442 1180",
    role: "visitor",
    createdAt: "2026-09-14T08:00:00.000Z",
    passwordHash:
      "d949210e0d28020725aef6f4c3bbe6e8e38d46881e527487e53d32a0bfca6acc",
  },
  {
    id: "usr_carlo_seed",
    email: "carlo.mendoza@example.com",
    fullName: "Carlo Mendoza",
    phone: "+63 920 118 7743",
    role: "visitor",
    createdAt: "2026-10-02T08:00:00.000Z",
    passwordHash:
      "37f186a01fa29f05c7684684dbb224ce28367b2f30b339b3fd24180666ba2d4f",
  },
];
