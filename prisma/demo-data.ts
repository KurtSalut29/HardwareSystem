/**
 * Demo data for presenting the system: six months of sales, supplier purchases,
 * online orders and a spread of stock levels, so EOQ, reorder points, reports,
 * charts and notifications all have something realistic to show.
 *
 *   npm run demo:add      add the demo data (refuses if it is already there)
 *   npm run demo:remove   delete it again and put stock back
 *
 * Everything added is recorded in the Setting row "demo_data", which is what
 * demo:remove reads. Real sales and purchases made in between are kept: stock
 * is restored by undoing only the demo's own change.
 *
 * Only the sample accounts from prisma/seed.ts are used (cashier1, cashier2,
 * customer1, customer2, driver1, admin). The numbers are generated from a fixed
 * seed, so every run produces the same data for the same products and day.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MARKER_KEY = "demo_data";
/** Days of sales history: six months, so the dashboard's 6-month chart is full. */
const DAYS = 180;
/** The window EOQ averages demand over (lib/inventory.ts). */
const EOQ_WINDOW = 90;
const DEMO_NOTE = "Demo data";

// The EOQ defaults (lib/inventory.ts). Used only to choose demo stock levels.
const ORDER_COST = 300;
const HOLDING_RATE = 0.2;
const COVER_DAYS = 3 + 2; // lead time + safety days

type Marker = {
  addedAt: string;
  transactionIds: number[];
  orderIds: number[];
  restockIds: number[];
  /** Stock each product had before, and the stock the demo set. */
  stock: Record<string, { before: number; set: number }>;
};

// ── Deterministic randomness ────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261110);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

function poisson(lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * (rand() + rand() + rand() - 1.5) * 2));
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rand(); } while (p > limit);
  return k - 1;
}

// ── How fast each kind of product sells (units per day, on an average day) ──
const RATES: [RegExp, number][] = [
  [/marine plywood/i, 0.5],
  [/plywood/i, 1.4],
  [/cement/i, 5],
  [/sand|gravel/i, 7],
  [/steel bar|deformed/i, 4],
  [/tie wire/i, 1.8],
  [/nail/i, 3],
  [/thhn|flat cord/i, 14],
  [/wire .*\(50m\)/i, 0.3],
  [/switch|outlet/i, 1.6],
  [/led bulb/i, 2.5],
  [/fluorescent/i, 0.7],
  [/breaker/i, 0.5],
  [/screw \d|self-drilling|wood screws/i, 1.1],
  [/hex bolt|anchor bolt/i, 5],
  [/hinge/i, 2.5],
  [/padlock/i, 0.6],
  [/door knob/i, 0.3],
  [/latex|enamel/i, 1.2],
  [/brush/i, 1.4],
  [/roller/i, 0.7],
  [/sandpaper/i, 1.3],
  [/pvc pipe/i, 3.5],
  [/elbow|tee/i, 7],
  [/gi pipe/i, 0.9],
  [/valve/i, 0.6],
  [/faucet/i, 0.35],
  [/shower/i, 0.25],
  [/drill|grinder|circular saw/i, 0.09],
  [/helmet/i, 0.35],
  [/gloves/i, 1.3],
  [/hammer|mallet/i, 0.45],
  [/screwdriver/i, 0.5],
  [/tape measure|level/i, 0.4],
  [/wrench|hacksaw/i, 0.3],
];
const rateFor = (name: string) => RATES.find(([re]) => re.test(name))?.[1] ?? 0.5;

// What the store pays a supplier, as a share of the selling price.
const COST_SHARE: [RegExp, number][] = [
  [/cement|sand|gravel|steel|plywood/i, 0.8],
  [/drill|grinder|saw/i, 0.72],
  [/nail|screw|bolt|wire/i, 0.68],
];
const costShareFor = (name: string) => COST_SHARE.find(([re]) => re.test(name))?.[1] ?? 0.65;

// Made-up supplier names.
const SUPPLIERS: [RegExp, string][] = [
  [/cement|sand|gravel|steel|tie wire|plywood/i, "Island Builders Supply"],
  [/wire|switch|outlet|bulb|lamp|breaker/i, "Eastern Visayas Electrical Trading"],
  [/pipe|elbow|tee|valve|faucet|shower/i, "Leyte Plumbing Depot"],
  [/drill|grinder|saw/i, "Visayas Power Tools Center"],
];
const supplierFor = (name: string) => SUPPLIERS.find(([re]) => re.test(name))?.[1] ?? "Biliran General Hardware Wholesale";

const ADDRESSES: [string, number, number][] = [
  ["Brgy. Sanggalang, Biliran, Biliran", 11.468, 124.476],
  ["Brgy. San Roque, Biliran, Biliran", 11.462, 124.482],
  ["Brgy. Busali, Biliran, Biliran", 11.452, 124.49],
  ["Brgy. Hugpa, Biliran, Biliran", 11.478, 124.469],
  ["Poblacion, Cabucgayan, Biliran", 11.473, 124.575],
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const niceQty = (n: number) => (n >= 50 ? Math.ceil(n / 10) * 10 : n >= 10 ? Math.ceil(n / 5) * 5 : Math.max(1, Math.ceil(n)));

function at(daysAgo: number, hour: number, minute: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, Math.floor(rand() * 60), 0);
  return d;
}

async function userId(username: string) {
  const u = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!u) throw new Error(`Sample account "${username}" not found. Demo data uses the accounts from prisma/seed.ts.`);
  return u.id;
}

// ── Add ─────────────────────────────────────────────────────────────────────
async function add() {
  if (await prisma.setting.findUnique({ where: { key: MARKER_KEY } })) {
    console.log('Demo data is already in this database. Run "npm run demo:remove" first to add it again.');
    return;
  }

  const [admin, cashier1, cashier2, customer1, customer2, driver1] = await Promise.all(
    ["admin", "cashier1", "cashier2", "customer1", "customer2", "driver1"].map(userId)
  );
  const staff = [cashier1, cashier1, cashier2]; // cashier1 works more shifts
  const products = await prisma.product.findMany({ select: { id: true, name: true, price: true, stock: true, unit: true }, orderBy: { id: "asc" } });
  if (products.length === 0) throw new Error("No products found. Run the normal seed first.");

  const marker: Marker = { addedAt: new Date().toISOString(), transactionIds: [], orderIds: [], restockIds: [], stock: {} };
  const sold = new Map<number, number>(products.map((p) => [p.id, 0]));
  // Sold within the EOQ window only, to place each product's demo stock level.
  const soldRecent = new Map<number, number>(products.map((p) => [p.id, 0]));
  const recentFrom = at(EOQ_WINDOW, 0, 0);
  const now = new Date();

  // 1. Daily sales → baskets → POS sales, with some baskets as online orders.
  type Line = { productId: number; productName: string; quantity: number; price: number };
  type Basket = { when: Date; lines: Line[] };
  const baskets: Basket[] = [];
  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const day = at(daysAgo, 0, 0);
    const weekday = day.getDay();
    const dayFactor = weekday === 0 ? 0.55 : weekday === 6 ? 1.3 : 1;
    const trend = 0.8 + 0.4 * ((DAYS - daysAgo) / DAYS); // a little busier lately
    const lines: Line[] = [];
    for (const p of products) {
      const q = poisson(rateFor(p.name) * dayFactor * trend);
      if (q > 0) lines.push({ productId: p.id, productName: p.name, quantity: q, price: p.price });
    }
    // Shuffle, then cut into baskets of 1–4 lines.
    for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
    for (let i = 0; i < lines.length; ) {
      const size = 1 + Math.floor(rand() * 4);
      let when = at(daysAgo, 7 + Math.floor(rand() * 10), Math.floor(rand() * 60));
      if (when > now) when = new Date(now.getTime() - (1 + Math.floor(rand() * 120)) * 60000);
      baskets.push({ when, lines: lines.slice(i, i + size) });
      i += size;
    }
  }
  baskets.sort((a, b) => a.when.getTime() - b.when.getTime());

  let posCount = 0;
  let onlineCount = 0;
  for (const b of baskets) {
    const total = round2(b.lines.reduce((s, l) => s + l.price * l.quantity, 0));
    b.lines.forEach((l) => {
      sold.set(l.productId, (sold.get(l.productId) ?? 0) + l.quantity);
      if (b.when >= recentFrom) soldRecent.set(l.productId, (soldRecent.get(l.productId) ?? 0) + l.quantity);
    });
    const handler = pick(staff);

    if (rand() < 0.12) {
      // A delivered online order, recorded as an "Online" sale on delivery.
      const delivery = rand() < 0.7;
      const gcash = rand() < 0.4;
      const [address, lat, lng] = pick(ADDRESSES);
      const deliveredAt = new Date(Math.min(now.getTime() - 60000, b.when.getTime() + (2 + rand() * 5) * 3600000));
      const sale = await prisma.transaction.create({
        data: {
          userId: handler, totalAmount: total, paymentMethod: gcash ? "GCash" : "Cash", type: "Online", dateTime: deliveredAt,
          items: { create: b.lines },
        },
      });
      const order = await prisma.order.create({
        data: {
          customerId: rand() < 0.6 ? customer1 : customer2,
          status: "delivered",
          totalAmount: total,
          dateTime: b.when,
          fulfillmentMode: delivery ? "delivery" : "pickup",
          paymentMethod: gcash ? "GCash" : "Cash",
          gcashNumber: gcash ? "09171234567" : null,
          gcashReference: gcash ? String(1000000000000 + Math.floor(rand() * 8999999999999)) : null,
          paymentVerified: gcash,
          amountPaid: total,
          deliveryAddress: delivery ? address : null,
          latitude: delivery ? Number((lat + between(-0.004, 0.004)).toFixed(5)) : null,
          longitude: delivery ? Number((lng + between(-0.004, 0.004)).toFixed(5)) : null,
          driverId: delivery ? driver1 : null,
          assignedAt: delivery ? new Date(b.when.getTime() + 3600000) : null,
          handledById: handler,
          transactionId: sale.id,
          items: { create: b.lines.map(({ productId, quantity, price }) => ({ productId, quantity, price })) },
        },
      });
      marker.transactionIds.push(sale.id);
      marker.orderIds.push(order.id);
      onlineCount++;
    } else {
      const sale = await prisma.transaction.create({
        data: {
          userId: handler, totalAmount: total, paymentMethod: rand() < 0.75 ? "Cash" : "GCash", type: "POS", dateTime: b.when,
          items: { create: b.lines },
        },
      });
      marker.transactionIds.push(sale.id);
      posCount++;
    }
  }

  // 2. Orders happening today: waiting for staff, and confirmed awaiting a driver.
  const live: { status: string; customer: number; hoursAgo: number; mode: string }[] = [
    { status: "pending", customer: customer1, hoursAgo: 0.5, mode: "delivery" },
    { status: "pending", customer: customer2, hoursAgo: 1.2, mode: "pickup" },
    { status: "pending", customer: customer1, hoursAgo: 2, mode: "delivery" },
    { status: "confirmed", customer: customer2, hoursAgo: 3, mode: "delivery" },
  ];
  const popular = products.filter((p) => rateFor(p.name) >= 1.5);
  for (const o of live) {
    const items = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(popular))
      .filter((p, i, xs) => xs.indexOf(p) === i)
      .map((p) => ({ productId: p.id, quantity: 1 + Math.floor(rand() * 4), price: p.price }));
    const [address, lat, lng] = pick(ADDRESSES);
    const order = await prisma.order.create({
      data: {
        customerId: o.customer, status: o.status, fulfillmentMode: o.mode, paymentMethod: "Cash",
        totalAmount: round2(items.reduce((s, i) => s + i.price * i.quantity, 0)),
        dateTime: new Date(now.getTime() - o.hoursAgo * 3600000),
        deliveryAddress: o.mode === "delivery" ? address : null,
        latitude: o.mode === "delivery" ? lat : null,
        longitude: o.mode === "delivery" ? lng : null,
        handledById: o.status === "pending" ? null : cashier1,
        items: { create: items },
      },
    });
    marker.orderIds.push(order.id);
  }

  // 3. Stock levels and supplier purchases. Each product gets a stock level that
  //    puts it in one of three states, so the reorder planner has something to show.
  const fast = products.filter((p) => rateFor(p.name) >= 1).map((p) => p.id);
  const outIds = new Set(fast.filter((_, i) => i % 9 === 4).slice(0, 4));
  const reorderIds = new Set(fast.filter((id, i) => i % 5 === 1 && !outIds.has(id)).slice(0, 7));

  let restockCount = 0;
  for (const p of products) {
    const daily = (soldRecent.get(p.id) ?? 0) / EOQ_WINDOW;
    const unitCost = Math.round(p.price * costShareFor(p.name) * 2) / 2;
    const annual = daily * 365;
    const eoq = annual > 0 ? Math.max(1, Math.ceil(Math.sqrt((2 * annual * ORDER_COST) / (unitCost * HOLDING_RATE)))) : 5;
    const rop = daily > 0 ? Math.max(1, Math.ceil(daily * COVER_DAYS)) : 5;

    const target = outIds.has(p.id) ? 0
      : reorderIds.has(p.id) ? Math.max(1, Math.floor(rop * between(0.35, 0.95)))
      : rop + Math.max(1, Math.round(eoq * between(0.5, 1.5)));
    marker.stock[p.id] = { before: p.stock, set: target };
    await prisma.product.update({ where: { id: p.id }, data: { stock: target } });

    // Purchases spread over the window, roughly one EOQ-sized order each time.
    const total = (sold.get(p.id) ?? 0) + target;
    const count = Math.min(8, Math.max(1, Math.round(total / Math.max(eoq, 1))));
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.round(DAYS - 3 - (i + rand() * 0.8) * ((DAYS - 6) / count));
      const quantity = niceQty(total / count);
      const cost = round2(unitCost * between(0.97, 1.03));
      const r = await prisma.restock.create({
        data: {
          productId: p.id, quantity, unitCost: cost, totalCost: round2(quantity * cost),
          supplierName: supplierFor(p.name), note: DEMO_NOTE,
          date: at(Math.max(1, daysAgo), 8 + Math.floor(rand() * 3), Math.floor(rand() * 60)),
          recordedById: rand() < 0.5 ? admin : cashier1,
        },
      });
      marker.restockIds.push(r.id);
      restockCount++;
    }
  }

  await prisma.setting.create({ data: { key: MARKER_KEY, value: JSON.stringify(marker) } });

  const revenue = await prisma.transaction.aggregate({ where: { id: { in: marker.transactionIds } }, _sum: { totalAmount: true } });
  console.log(`✓ ${posCount} POS sales and ${onlineCount} delivered online orders over the last ${DAYS} days (₱${Math.round(revenue._sum.totalAmount ?? 0).toLocaleString("en-PH")})`);
  console.log(`✓ ${live.length} orders today (3 waiting for staff, 1 confirmed and waiting for a driver)`);
  console.log(`✓ ${restockCount} supplier purchases`);
  console.log(`✓ Stock set: ${outIds.size} out of stock, ${reorderIds.size} at their reorder point, the rest healthy`);
  console.log('Remove it any time with "npm run demo:remove".');
}

// ── Remove ──────────────────────────────────────────────────────────────────
async function remove() {
  const row = await prisma.setting.findUnique({ where: { key: MARKER_KEY } });
  if (!row) {
    console.log("No demo data in this database — nothing to remove.");
    return;
  }
  const m: Marker = JSON.parse(row.value);

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: { in: m.orderIds } } });
    await tx.order.deleteMany({ where: { id: { in: m.orderIds } } });
    // Real orders could have been linked to a demo sale at the POS; unlink them first.
    await tx.order.updateMany({ where: { transactionId: { in: m.transactionIds } }, data: { transactionId: null } });
    await tx.transactionItem.deleteMany({ where: { transactionId: { in: m.transactionIds } } });
    await tx.transaction.deleteMany({ where: { id: { in: m.transactionIds } } });
    await tx.restock.deleteMany({ where: { id: { in: m.restockIds } } });
    // Undo only the demo's own stock change, keeping real sales and purchases made since.
    for (const [id, s] of Object.entries(m.stock)) {
      await tx.product.updateMany({ where: { id: Number(id) }, data: { stock: { increment: round2(s.before - s.set) } } });
    }
    await tx.setting.delete({ where: { key: MARKER_KEY } });
  }, { timeout: 120000 });

  console.log(`✓ Removed ${m.transactionIds.length} sales, ${m.orderIds.length} orders and ${m.restockIds.length} purchases, and restored stock.`);
}

(process.argv.includes("--remove") ? remove() : add())
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
