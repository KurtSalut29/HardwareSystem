import { STORE_ADDRESS, STORE_NAME } from "@/lib/brand";

/**
 * Every store-wide setting the admin controls from Settings, with its default
 * and limits. The admin page builds its form from this list, the API validates
 * against it, and the rest of the system reads the saved values through
 * getSettings() (server) or useSettings() (browser). Changes apply immediately.
 *
 * Delivery fees and the store's map pin have their own long-standing settings
 * (lib/deliveryFee.ts, /api/store-location); the Settings page edits those too.
 */

export type SettingGroup = "store" | "gcash" | "payments" | "cancellation" | "orders" | "inventory" | "accounts" | "receipts";

type Base = {
  /** Row key in the Setting table. */
  key: string;
  group: SettingGroup;
  label: string;
  hint?: string;
  /** Shown to everyone (customers need these at checkout). Others are admin-only. */
  public?: boolean;
};

export type SettingDef =
  | (Base & { type: "boolean"; default: boolean })
  | (Base & { type: "number"; default: number; min: number; max: number; prefix?: string; suffix?: string; step?: number; whole?: boolean })
  | (Base & { type: "text"; default: string; max: number; multiline?: boolean; placeholder?: string; required?: boolean })
  | (Base & { type: "phone"; default: string })
  | (Base & { type: "image"; default: string })
  | (Base & { type: "choice"; default: string; options: { value: string; label: string }[] });

export const DEFAULT_REFUND_POLICY =
  "You can cancel from My Orders while your order is still allowed to be cancelled. If you already paid, we refund it to the GCash number you paid from (or in cash at the store). Orders the store cancels are always refunded in full.";

export const SETTING_DEFS = {
  /* ── Store ── */
  storeName: { key: "store_name", group: "store", type: "text", label: "Store name", default: STORE_NAME, max: 60, required: true, public: true,
    hint: "Shown on receipts, emails and the home page." },
  storeAddress: { key: "store_address", group: "store", type: "text", label: "Address", default: STORE_ADDRESS, max: 150, required: true, public: true },
  storeContact: { key: "store_contact", group: "store", type: "phone", label: "Contact number", default: "", public: true,
    hint: "Shown on receipts and to customers who need to call the store." },
  storeHours: { key: "store_hours", group: "store", type: "text", label: "Store hours", default: "Mon–Sat, 7:00 AM – 5:00 PM", max: 80, public: true },

  /* ── GCash ── */
  gcashEnabled: { key: "gcash_enabled", group: "gcash", type: "boolean", label: "Accept GCash", default: true, public: true,
    hint: "Turn off to hide GCash at checkout. Payments already sent are still reviewed." },
  gcashName: { key: "gcash_name", group: "gcash", type: "text", label: "Account name", default: "", max: 60, public: true, placeholder: "e.g. R*** M***" },
  gcashNumber: { key: "gcash_number", group: "gcash", type: "phone", label: "GCash number", default: "", public: true },
  gcashQr: { key: "gcash_qr", group: "gcash", type: "image", label: "GCash QR code", default: "", public: true,
    hint: "Customers scan this to pay. A screenshot from the GCash app works." },

  /* ── Payments ── */
  codEnabled: { key: "cod_enabled", group: "payments", type: "boolean", label: "Accept cash", default: true, public: true,
    hint: "Cash on delivery, or cash when picking up at the store." },
  minDownpaymentPct: { key: "min_downpayment_pct", group: "payments", type: "number", label: "Minimum GCash downpayment", default: 50, min: 1, max: 100, suffix: "%", whole: true, public: true,
    hint: "A customer paying part by GCash must send at least this much of the total. 100% means full payment only." },
  balanceDueDays: { key: "balance_due_days", group: "payments", type: "number", label: "Days to pay the balance", default: 3, min: 1, max: 30, suffix: "days", whole: true, public: true,
    hint: "After a downpayment is approved, the rest is due within this many days. Late balances are flagged for staff." },
  allowBalanceOnDelivery: { key: "allow_balance_on_delivery", group: "payments", type: "boolean", label: "Balance can be paid in cash on delivery or pickup", default: true, public: true,
    hint: "Off: the balance must be paid by GCash before the order goes out." },
  prepareAfterDownpayment: { key: "prepare_after_downpayment", group: "payments", type: "boolean", label: "Confirm GCash orders only after a payment is approved", default: true, public: true,
    hint: "Staff can't confirm a GCash order until its receipt has been checked and approved." },
  requireDownpaymentOver: { key: "require_downpayment_over", group: "payments", type: "number", label: "Cash orders above this amount need a GCash downpayment", default: 0, min: 0, max: 1000000, prefix: "₱", public: true,
    hint: "Protects against fake large orders. 0 turns this off." },

  /* ── Cancellation & refunds ── */
  customerCancelUntil: { key: "customer_cancel_until", group: "cancellation", type: "choice", label: "Customers can cancel", default: "confirmed", public: true,
    options: [
      { value: "pending", label: "Only before the store confirms the order" },
      { value: "confirmed", label: "Until the order leaves the store" },
    ],
    hint: "Once an order is out for delivery, the customer has to call the store." },
  cancelFeeType: { key: "cancel_fee_type", group: "cancellation", type: "choice", label: "Cancellation fee type", default: "percent", public: true,
    options: [{ value: "percent", label: "Percent of what was paid" }, { value: "fixed", label: "Fixed amount" }] },
  cancelFeeValue: { key: "cancel_fee_value", group: "cancellation", type: "number", label: "Cancellation fee", default: 0, min: 0, max: 100000, public: true,
    hint: "Kept from the refund when a customer cancels after the store confirmed. Cancelling before confirmation, or a cancellation by the store, is always refunded in full. 0 = no fee." },
  refundPolicy: { key: "refund_policy", group: "cancellation", type: "text", label: "Cancellation and refund policy", default: DEFAULT_REFUND_POLICY, max: 800, multiline: true, required: true, public: true,
    hint: "Customers must agree to this before placing an order." },

  /* ── Orders ── */
  deliveryEnabled: { key: "delivery_enabled", group: "orders", type: "boolean", label: "Offer delivery", default: true, public: true },
  pickupEnabled: { key: "pickup_enabled", group: "orders", type: "boolean", label: "Offer pickup at the store", default: true, public: true },
  deliveryMinOrder: { key: "delivery_min_order", group: "orders", type: "number", label: "Minimum order for delivery", default: 0, min: 0, max: 1000000, prefix: "₱", public: true,
    hint: "Items total needed before delivery can be chosen. 0 = no minimum." },

  /* ── Inventory ── */
  lowStockLevel: { key: "low_stock_level", group: "inventory", type: "number", label: "\"Only a few left\" at or below", default: 10, min: 1, max: 10000, whole: true, public: true,
    hint: "Customers see \"Only N left\" when a product's stock is at or below this." },
  publicShowStock: { key: "public_show_stock", group: "inventory", type: "boolean", label: "Show how many are in stock to customers", default: true, public: true,
    hint: "Off: customers only see In stock / Out of stock." },

  /* ── Accounts & email ── */
  requireCustomerApproval: { key: "require_customer_approval", group: "accounts", type: "boolean", label: "New customer accounts need approval", default: true,
    hint: "Off: customers can order right after signing up." },
  emailCustomerUpdates: { key: "email_customer_updates", group: "accounts", type: "boolean", label: "Email customers about payments and refunds", default: true,
    hint: "Needs the store Gmail set up on the server. Customers can also turn these emails off for themselves." },

  /* ── Receipts ── */
  receiptFooter: { key: "receipt_footer", group: "receipts", type: "text", label: "Message at the bottom of receipts", default: "Thank you for your purchase!", max: 120, required: true, public: true },
} as const satisfies Record<string, SettingDef>;

export type SettingId = keyof typeof SETTING_DEFS;

type ValueOf<D> = D extends { type: "boolean" } ? boolean : D extends { type: "number" } ? number : string;
export type AppSettings = { [K in SettingId]: ValueOf<(typeof SETTING_DEFS)[K]> };
export type PublicSettings = AppSettings;

export const SETTING_IDS = Object.keys(SETTING_DEFS) as SettingId[];

export function defaultSettings(): AppSettings {
  const out = {} as Record<SettingId, unknown>;
  for (const id of SETTING_IDS) out[id] = SETTING_DEFS[id].default;
  return out as AppSettings;
}

/** Turns a stored string back into its value; falls back to the default when invalid. */
export function decodeSetting(id: SettingId, raw: string | undefined | null): AppSettings[SettingId] {
  const def = SETTING_DEFS[id] as SettingDef;
  if (raw == null) return def.default as AppSettings[SettingId];
  switch (def.type) {
    case "boolean": return (raw === "true") as AppSettings[SettingId];
    case "number": {
      const n = Number(raw);
      return (Number.isFinite(n) && n >= def.min && n <= def.max ? n : def.default) as AppSettings[SettingId];
    }
    case "choice": return (def.options.some((o) => o.value === raw) ? raw : def.default) as AppSettings[SettingId];
    default: return raw as AppSettings[SettingId];
  }
}

/** Checks one value from the admin form. Returns the string to store, or an error. */
export function encodeSetting(id: SettingId, value: unknown): { value: string } | { error: string } {
  const def = SETTING_DEFS[id] as SettingDef;
  switch (def.type) {
    case "boolean":
      if (typeof value !== "boolean") return { error: `${def.label}: choose on or off.` };
      return { value: String(value) };
    case "number": {
      const n = Number(value);
      if (value === "" || value == null || !Number.isFinite(n)) return { error: `${def.label}: enter a number.` };
      if (n < def.min || n > def.max) return { error: `${def.label}: enter ${def.min} to ${def.max.toLocaleString("en-PH")}.` };
      if (def.whole && !Number.isInteger(n)) return { error: `${def.label}: whole numbers only.` };
      return { value: String(Math.round(n * 100) / 100) };
    }
    case "text": {
      const t = String(value ?? "").trim();
      if (def.required && !t) return { error: `${def.label} can't be empty.` };
      if (t.length > def.max) return { error: `${def.label}: ${def.max} characters at most.` };
      return { value: t };
    }
    case "phone": {
      const t = String(value ?? "").replace(/[\s-]/g, "");
      if (t && !/^09\d{9}$/.test(t)) return { error: `${def.label}: 11 digits starting with 09.` };
      return { value: t };
    }
    case "image": {
      const t = String(value ?? "");
      if (t && !t.startsWith("/api/uploads/") && !t.startsWith("/uploads/")) return { error: `${def.label}: upload the image again.` };
      return { value: t };
    }
    case "choice": {
      const t = String(value ?? "");
      if (!def.options.some((o) => o.value === t)) return { error: `${def.label}: choose one of the options.` };
      return { value: t };
    }
  }
}

/** The cancellation fee on an amount already paid, per the store's settings. */
export function cancellationFee(paid: number, s: Pick<AppSettings, "cancelFeeType" | "cancelFeeValue">): number {
  if (paid <= 0 || s.cancelFeeValue <= 0) return 0;
  const fee = s.cancelFeeType === "fixed" ? s.cancelFeeValue : (paid * s.cancelFeeValue) / 100;
  return Math.min(paid, Math.round(fee * 100) / 100);
}
