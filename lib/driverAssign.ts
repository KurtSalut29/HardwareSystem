import { prisma } from "@/lib/prisma";
import { getDeliverySettings } from "@/lib/deliverySettings";
import { canTakeOrder, driverAvailability, unavailableReason } from "@/lib/driverStatus";

/**
 * Whether a driver can be handed a new delivery right now (on duty, and under
 * the admin's "deliveries at a time" limit). Used when staff pick a driver while
 * taking an order or while switching a pickup order to delivery.
 */
export async function checkDriverForNewDelivery(rawId: unknown): Promise<{ id: number } | { error: string; status: number }> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return { error: "Invalid driver", status: 400 };
  const driver = await prisma.user.findUnique({ where: { id } });
  if (!driver || driver.role !== "driver") return { error: "Invalid driver", status: 400 };
  const [active, settings] = await Promise.all([
    prisma.order.count({ where: { driverId: id, status: "out_for_delivery" } }),
    getDeliverySettings(),
  ]);
  const availability = driverAvailability(driver.onDuty, active, settings.driverMaxActive);
  if (!canTakeOrder(availability)) {
    return { error: unavailableReason(driver.username, availability, active, settings.driverMaxActive) ?? "That driver can't take a delivery right now.", status: 409 };
  }
  return { id };
}
