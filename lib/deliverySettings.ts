import { prisma } from "@/lib/prisma";
import { DELIVERY_DEFAULTS, DELIVERY_LIMITS, DELIVERY_SETTING_KEYS, type DeliverySettings } from "@/lib/deliveryFee";

/** Server-side: the saved delivery fee settings, with defaults for anything unset. */
export async function getDeliverySettings(): Promise<DeliverySettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(DELIVERY_SETTING_KEYS) } } });
  const s = { ...DELIVERY_DEFAULTS };
  for (const f of Object.keys(DELIVERY_SETTING_KEYS) as (keyof DeliverySettings)[]) {
    const n = Number(rows.find((r) => r.key === DELIVERY_SETTING_KEYS[f])?.value);
    if (Number.isFinite(n)) s[f] = n;
  }
  return s;
}

export function parseDeliverySettings(input: Record<string, unknown>): { error: string } | { values: Partial<DeliverySettings> } {
  const values: Partial<DeliverySettings> = {};
  for (const f of Object.keys(DELIVERY_SETTING_KEYS) as (keyof DeliverySettings)[]) {
    if (input[f] === undefined) continue;
    const n = Number(input[f]);
    const { min, max } = DELIVERY_LIMITS[f];
    if (!Number.isFinite(n) || n < min || n > max) return { error: `${f} must be a number from ${min} to ${max}.` };
    values[f] = n;
  }
  return { values };
}

export async function saveDeliverySettings(values: Partial<DeliverySettings>) {
  await prisma.$transaction(
    (Object.keys(values) as (keyof DeliverySettings)[]).map((f) =>
      prisma.setting.upsert({
        where: { key: DELIVERY_SETTING_KEYS[f] },
        update: { value: String(values[f]) },
        create: { key: DELIVERY_SETTING_KEYS[f], value: String(values[f]) },
      })
    )
  );
}

/** The store pin deliveries are measured from: the saved one, else the same default the map uses. */
export async function getStorePin(): Promise<{ lat: number; lng: number }> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ["store_lat", "store_lng"] } } });
  const num = (k: string) => { const n = parseFloat(rows.find((r) => r.key === k)?.value ?? ""); return Number.isFinite(n) ? n : null; };
  return {
    lat: num("store_lat") ?? parseFloat(process.env.STORE_LAT ?? "11.4573"),
    lng: num("store_lng") ?? parseFloat(process.env.STORE_LNG ?? "124.5638"),
  };
}
