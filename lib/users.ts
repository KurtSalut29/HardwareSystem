/** What the Users page reads about an account. Never the password hash. */
export const USER_SELECT = {
  id: true, username: true, role: true, contact: true, email: true, createdAt: true,
  firstName: true, middleName: true, lastName: true, suffix: true,
  accountStatus: true, statusNote: true, reviewedAt: true,
  defaultAddress: true, defaultLat: true, defaultLng: true,
} as const;

export type AccountStatus = "pending" | "approved" | "rejected";
