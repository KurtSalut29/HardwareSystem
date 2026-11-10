/**
 * Whether a driver can take another delivery.
 *
 *  - off_duty:   the driver switched themselves off (break, day off).
 *  - full:       carrying as many deliveries as the admin allows at once
 *                ("Deliveries per driver at a time" in Delivery settings).
 *  - delivering: on the road, but still has room for another stop.
 *  - available:  on duty with nothing on hand.
 *
 * Only "available" and "delivering" drivers can be assigned; the orders API
 * enforces it, so a busy or off-duty driver is never handed a new order.
 */
export type DriverAvailability = "available" | "delivering" | "full" | "off_duty";

export function driverAvailability(onDuty: boolean, active: number, maxActive: number): DriverAvailability {
  if (!onDuty) return "off_duty";
  if (active >= maxActive) return "full";
  return active > 0 ? "delivering" : "available";
}

export const canTakeOrder = (a: DriverAvailability) => a === "available" || a === "delivering";

export const AVAILABILITY_LABEL: Record<DriverAvailability, string> = {
  available: "Available",
  delivering: "On delivery",
  full: "Busy — still delivering",
  off_duty: "Off duty",
};

/** Why a driver can't be picked, for the assign dropdown and the API error. */
export function unavailableReason(username: string, a: DriverAvailability, active: number, maxActive: number): string | null {
  if (a === "off_duty") return `${username} is off duty.`;
  if (a === "full") {
    return maxActive === 1
      ? `${username} is still on a delivery. Assign once it's done.`
      : `${username} already has ${active} deliveries (the most at a time is ${maxActive}).`;
  }
  return null;
}

type PickDriver = { username: string; activeCount: number; maxActive?: number; availability?: DriverAvailability };

/** How a driver reads in an "Assign driver" dropdown, and whether they can be picked. */
export function driverOption(d: PickDriver): { label: string; disabled: boolean } {
  const a = d.availability ?? "available";
  const max = d.maxActive ?? 1;
  if (a === "off_duty") return { label: `${d.username} — off duty`, disabled: true };
  if (a === "full") return { label: `${d.username} — busy (${d.activeCount} on the road)`, disabled: true };
  if (a === "delivering") return { label: `${d.username} — on delivery, ${max - d.activeCount} more allowed`, disabled: false };
  return { label: `${d.username} — available`, disabled: false };
}
