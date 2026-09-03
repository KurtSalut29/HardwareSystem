// Display names for roles.
//
// The `cashier` role string is baked into JWTs, the middleware route table, the
// users table and every existing account, so renaming it in the database would
// be a breaking change for no benefit. The client only asked for the *label* to
// read "Staff", so the rename lives here at the presentation layer.
export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  cashier: "Staff",
  customer: "Customer",
  driver: "Driver",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
