import { prisma } from "@/lib/prisma";

/**
 * Inventory planning with EOQ (Economic Order Quantity) and a reorder point.
 *
 *   EOQ = √(2 × D × S ÷ H)        how many units to order each time
 *   ROP = d × (L + safety days)    order again when stock falls to this
 *
 *   D = yearly demand (units), estimated from recent sales
 *   d = average daily demand (units per day)
 *   S = cost of placing one order (₱), set by the admin
 *   H = cost of holding one unit for a year (₱) = unit cost × holding rate
 *   L = supplier lead time in days, set by the admin
 *
 * Demand comes from every recorded sale: POS sales and delivered online orders
 * (both are Transactions). The unit cost is the latest one paid on the Restocks
 * page; a product never restocked falls back to its selling price, flagged as
 * an estimate.
 */

export type EoqSettings = {
  /** S: cost of placing one order with a supplier, in pesos. */
  orderCost: number;
  /** Holding cost per year, as a percent of the unit cost (H = unit cost × rate). */
  holdingRate: number;
  /** L: days between ordering and the stock arriving. */
  leadTimeDays: number;
  /** Extra days of demand kept as safety stock. */
  safetyDays: number;
};

export const EOQ_DEFAULTS: EoqSettings = { orderCost: 300, holdingRate: 20, leadTimeDays: 3, safetyDays: 2 };

/** Allowed range for each setting, shared by the API and the settings form. */
export const EOQ_LIMITS: Record<keyof EoqSettings, { min: number; max: number }> = {
  orderCost: { min: 0, max: 100000 },
  holdingRate: { min: 1, max: 100 },
  leadTimeDays: { min: 0, max: 90 },
  safetyDays: { min: 0, max: 90 },
};

const SETTING_KEYS: Record<keyof EoqSettings, string> = {
  orderCost: "eoq_order_cost",
  holdingRate: "eoq_holding_rate",
  leadTimeDays: "eoq_lead_time_days",
  safetyDays: "eoq_safety_days",
};

/** How far back sales are averaged to estimate demand. */
export const DEMAND_WINDOW_DAYS = 90;
/** A product younger than this still averages over this many days, so one early sale doesn't look like a trend. */
const MIN_WINDOW_DAYS = 7;
/** Reorder point for a product with no sales yet, so it still warns before running out. */
export const NO_HISTORY_REORDER_POINT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getEoqSettings(): Promise<EoqSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(SETTING_KEYS) } } });
  const settings = { ...EOQ_DEFAULTS };
  for (const field of Object.keys(SETTING_KEYS) as (keyof EoqSettings)[]) {
    const raw = rows.find((r) => r.key === SETTING_KEYS[field])?.value;
    const n = raw == null ? NaN : Number(raw);
    if (Number.isFinite(n)) settings[field] = n;
  }
  return settings;
}

/** Validates a partial update. Returns an error message, or the cleaned values. */
export function parseEoqSettings(input: Record<string, unknown>): { error: string } | { values: Partial<EoqSettings> } {
  const values: Partial<EoqSettings> = {};
  for (const field of Object.keys(SETTING_KEYS) as (keyof EoqSettings)[]) {
    if (input[field] === undefined) continue;
    const n = Number(input[field]);
    const { min, max } = EOQ_LIMITS[field];
    if (!Number.isFinite(n) || n < min || n > max) {
      return { error: `${field} must be a number from ${min} to ${max}.` };
    }
    values[field] = n;
  }
  return { values };
}

export async function saveEoqSettings(values: Partial<EoqSettings>) {
  await prisma.$transaction(
    (Object.entries(values) as [keyof EoqSettings, number][]).map(([field, value]) =>
      prisma.setting.upsert({
        where: { key: SETTING_KEYS[field] },
        update: { value: String(value) },
        create: { key: SETTING_KEYS[field], value: String(value) },
      })
    )
  );
}

export type ReorderStatus = "out" | "reorder" | "ok";

export type ReorderRow = {
  productId: number;
  name: string;
  category: string;
  unit: string;
  image: string | null;
  stock: number;
  /** Units sold in the averaging window. */
  sold: number;
  /** Days the sales were averaged over. */
  windowDays: number;
  /** d: average units sold per day. */
  dailyDemand: number;
  /** D: estimated units sold per year. */
  annualDemand: number;
  /** Unit cost used for H. */
  unitCost: number;
  /** "restock": latest purchase cost. "price": no purchase recorded, selling price used as an estimate. */
  costSource: "restock" | "price";
  /** H: yearly cost of holding one unit. */
  holdingCost: number;
  /** Suggested order quantity, or null when there are no sales to base it on. */
  eoq: number | null;
  safetyStock: number;
  reorderPoint: number;
  /** "sales": computed from demand. "default": no sales yet, a fixed minimum is used. */
  reorderBasis: "sales" | "default";
  /** Days until stock runs out at the current pace, or null without sales. */
  daysLeft: number | null;
  status: ReorderStatus;
};

export type ReorderPlan = {
  settings: EoqSettings;
  windowDays: number;
  generatedAt: string;
  rows: ReorderRow[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getReorderPlan(): Promise<ReorderPlan> {
  const now = Date.now();
  const since = new Date(now - DEMAND_WINDOW_DAYS * DAY_MS);

  const [settings, products, sales, latestCosts] = await Promise.all([
    getEoqSettings(),
    prisma.product.findMany({
      select: { id: true, name: true, unit: true, image: true, stock: true, price: true, createdAt: true, category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.transactionItem.groupBy({
      by: ["productId"],
      where: { transaction: { dateTime: { gte: since } } },
      _sum: { quantity: true },
    }),
    prisma.restock.findMany({
      orderBy: { date: "desc" },
      distinct: ["productId"],
      select: { productId: true, unitCost: true },
    }),
  ]);

  const soldBy = new Map(sales.map((s) => [s.productId, s._sum.quantity ?? 0]));
  const costBy = new Map(latestCosts.map((r) => [r.productId, r.unitCost]));

  const rows = products.map<ReorderRow>((p) => {
    const ageDays = (now - p.createdAt.getTime()) / DAY_MS;
    const windowDays = Math.round(Math.min(DEMAND_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, ageDays)));
    const sold = soldBy.get(p.id) ?? 0;
    const dailyDemand = sold / windowDays;
    const annualDemand = dailyDemand * 365;

    const restockCost = costBy.get(p.id);
    const unitCost = restockCost ?? p.price;
    const holdingCost = unitCost * (settings.holdingRate / 100);

    const eoq = annualDemand > 0 && holdingCost > 0
      ? Math.max(1, Math.ceil(Math.sqrt((2 * annualDemand * settings.orderCost) / holdingCost)))
      : null;

    const hasSales = dailyDemand > 0;
    const safetyStock = hasSales ? Math.ceil(dailyDemand * settings.safetyDays) : 0;
    const reorderPoint = hasSales
      ? Math.max(1, Math.ceil(dailyDemand * (settings.leadTimeDays + settings.safetyDays)))
      : NO_HISTORY_REORDER_POINT;

    const status: ReorderStatus = p.stock <= 0 ? "out" : p.stock <= reorderPoint ? "reorder" : "ok";

    return {
      productId: p.id,
      name: p.name,
      category: p.category?.name ?? "Uncategorized",
      unit: p.unit,
      image: p.image,
      stock: p.stock,
      sold: round2(sold),
      windowDays,
      dailyDemand: round2(dailyDemand),
      annualDemand: Math.round(annualDemand),
      unitCost: round2(unitCost),
      costSource: restockCost != null ? "restock" : "price",
      holdingCost: round2(holdingCost),
      eoq,
      safetyStock,
      reorderPoint,
      reorderBasis: hasSales ? "sales" : "default",
      daysLeft: hasSales ? Math.floor(p.stock / dailyDemand) : null,
      status,
    };
  });

  return { settings, windowDays: DEMAND_WINDOW_DAYS, generatedAt: new Date(now).toISOString(), rows };
}

/** Products that need ordering: out of stock first, then the ones closest to running out. */
export function needsAttention(rows: ReorderRow[]): ReorderRow[] {
  const rank = { out: 0, reorder: 1, ok: 2 } as const;
  return rows
    .filter((r) => r.status !== "ok")
    .sort((a, b) => rank[a.status] - rank[b.status] || a.stock / a.reorderPoint - b.stock / b.reorderPoint);
}
