/**
 * Who an order is for. Online orders belong to a customer account; orders staff
 * take by phone or at the counter for someone without an account carry the
 * name (and number) typed in instead.
 */
export type OrderCustomer = {
  customer?: { username: string; contact?: string | null } | null;
  customerName?: string | null;
  customerContact?: string | null;
};

export function customerLabel(o: OrderCustomer): string {
  return o.customer?.username ?? o.customerName ?? "Walk-in customer";
}

export function customerPhone(o: OrderCustomer): string | null {
  return o.customer?.contact ?? o.customerContact ?? null;
}

/** True when the order was taken by staff for someone without an account. */
export function isWalkIn(o: OrderCustomer): boolean {
  return !o.customer;
}
