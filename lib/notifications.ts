import type { AlertSound } from "@/lib/sounds";

export type NotificationType = "new_order" | "low_stock" | "out_of_stock" | "order_update";

export type AppNotification = {
  /** Stable for as long as the situation lasts, so the same alert never rings twice. */
  key: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  at: string;
};

/** The sound each kind of notification plays. */
export const SOUND_FOR: Record<NotificationType, AlertSound> = {
  new_order: "new_order",
  low_stock: "low_stock",
  out_of_stock: "out_of_stock",
  order_update: "order_update",
};
