/**
 * Demo data for presenting the system, built to feel like a real store's records.
 *
 *   npm run demo:add      add the demo data (refuses if it is already there)
 *   npm run demo:remove   delete all of it again and restore what it changed
 *
 * Where the data comes from
 *   prisma/demo/biliran-addresses.json holds real barangays of all 8 Biliran
 *   municipalities and real building positions in each (OpenStreetMap, ODbL).
 *   Every delivery address is one of those buildings, so every pin on the map
 *   sits on an actual house in the right barangay and town, never in the sea.
 *
 * What it adds
 *   - 10 customers per municipality (fictional names), each living at one house.
 *   - 50 delivery orders per municipality (400 in all) over the last 5 months:
 *     older ones delivered (a few cancelled), plus today's pending, confirmed and
 *     out-for-delivery orders, with the driver shown on the way.
 *   - A second driver; each driver covers one side of the island.
 *   - Six months of walk-in counter (POS) sales, supplier purchases, and stock
 *     levels that put a handful of products at or below their reorder point.
 *   - The store pin moved to Brgy. Sanggalang, Biliran (restored on remove).
 *
 * Everything added is recorded in the Setting row "demo_data"; demo:remove reads
 * it, deletes those rows and undoes only the demo's own stock change, so real
 * sales and purchases made in between are kept.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const MARKER_KEY = "demo_data";
const HISTORY_DAYS = 180; // counter sales: six months, so the 6-month sales chart is full
const ORDER_DAYS = 150; // online orders
const ORDERS_PER_TOWN = 50;
const CUSTOMERS_PER_TOWN = 10;
const EOQ_WINDOW = 90;
// EOQ defaults (lib/inventory.ts), used only to choose demo stock levels.
const ORDER_COST = 300;
const HOLDING_RATE = 0.2;
const COVER_DAYS = 3 + 2;

type Home = [number, number];
type Barangay = { name: string; lat: number; lng: number; homes: Home[] };
type AddressBook = { municipalities: Record<string, Barangay[]> };

type Marker = {
  addedAt: string;
  userIds: number[];
  orderIds: number[];
  transactionIds: number[];
  restockIds: number[];
  stock: Record<string, { before: number; set: number }>;
  storeSettings: Record<string, string | null>;
};

// ── Deterministic randomness: the same data every run ───────────────────────
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
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [x, w] of items) { r -= w; if (r <= 0) return x; }
  return items[items.length - 1][0];
}
function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function poisson(lambda: number): number {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > limit);
  return k - 1;
}
const round2 = (n: number) => Math.round(n * 100) / 100;
function km(a: Home, b: Home) {
  const dy = (a[0] - b[0]) * 111.32;
  const dx = (a[1] - b[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

const NOW = new Date();
function dayAt(daysAgo: number, hour: number, minute = int(0, 59)) {
  const d = new Date(NOW);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, int(0, 59), 0);
  return d;
}
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
const notAfterNow = (d: Date) => (d > NOW ? new Date(NOW.getTime() - int(2, 20) * 60000) : d);

// ── Fictional customers ──────────────────────────────────────────────────────
const FIRST = ["Maria", "Jose", "Rosalinda", "Rodel", "Joel", "Arnel", "Jocelyn", "Lorna", "Ramil", "Edgardo", "Nestor",
  "Analyn", "Mylene", "Ronaldo", "Gerardo", "Cristina", "Leonora", "Rogelio", "Danilo", "Marivic", "Rowena", "Elmer",
  "Wilfredo", "Teresita", "Merlie", "Alfredo", "Benjie", "Dexter", "Jessa", "Kristine", "Mark Anthony", "John Rey",
  "Rhea", "Gina", "Noel", "Romeo", "Lilibeth", "Erwin", "Jerome", "Aileen", "Melchor", "Virgilio", "Nida", "Precious",
  "Jonel", "Rosemarie", "Felix", "Charito", "Ernesto", "Junrey", "Michelle", "Reynaldo", "Shiela", "Ariel", "Glenda"];
const LAST = ["Abellana", "Bacalso", "Caballero", "Sabenorio", "Moreto", "Pajaron", "Lumanog", "Cañete", "Bacus",
  "Villaflor", "Espina", "Montes", "Salazar", "Tabanao", "Laurente", "Pacaña", "Ompad", "Codilla", "Ybañez", "Gonzaga",
  "Labrador", "Remotigue", "Mercado", "Navarro", "Solis", "Bernal", "Sumalinog", "Cabahug", "Dagami", "Escalante",
  "Lagumbay", "Maglasang", "Nacorda", "Opeña", "Pilapil", "Quijano", "Rosales", "Tibay", "Unabia", "Verano"];

// ── What people buy ──────────────────────────────────────────────────────────
// [product name pattern, min qty, max qty]
type Line = [RegExp, number, number];
const KITS: Record<string, { lines: Line[]; pickMin: number; pickMax: number }> = {
  household: { pickMin: 1, pickMax: 3, lines: [
    [/^LED Bulb/, 2, 6], [/^Single Switch/, 1, 3], [/^Duplex Outlet/, 1, 3], [/^Faucet/, 1, 1], [/^Shower Head/, 1, 1],
    [/^Padlock/, 1, 2], [/^Door Knob/, 1, 1], [/^Stainless Hinge/, 2, 6], [/^Latex Paint/, 1, 4], [/^Paint Brush/, 1, 3],
    [/^Paint Roller$/, 1, 2], [/^Sandpaper/, 1, 3], [/^Tape Measure \(5m\)/, 1, 1], [/^Claw Hammer$/, 1, 1],
    [/^Screwdriver Set/, 1, 1], [/^Common Wire Nail 2/, 1, 2], [/^Wood Screw 1/, 1, 2]] },
  repair: { pickMin: 2, pickMax: 4, lines: [
    [/^PVC Pipe 1\/2" x 3m/, 2, 6], [/^PVC Elbow 1\/2/, 3, 10], [/^Tee Connector/, 2, 6], [/^Gate Valve/, 1, 2],
    [/^Ball Valve/, 1, 2], [/^THHN Wire/, 10, 40], [/^Circuit Breaker/, 1, 2], [/^Duplex Outlet/, 1, 4],
    [/^Roofing Nail/, 1, 3], [/^Self-Drilling Screw/, 1, 2], [/^Plywood 1\/4" 4x8/, 1, 3], [/^Enamel Paint/, 1, 3]] },
  construction: { pickMin: 3, pickMax: 5, lines: [
    [/^Portland Cement \(40kg\)/, 10, 40], [/^Washed Sand/, 8, 30], [/^Gravel/, 8, 30], [/^Deformed Steel Bar/, 10, 40],
    [/^Steel Bar 12mm/, 6, 20], [/^GI Tie Wire/, 2, 5], [/^Common Nails \(2"\)/, 2, 6], [/^Concrete Nails/, 1, 3],
    [/^Plywood 1\/4" 4x8/, 4, 12], [/^Marine Plywood/, 2, 6]] },
};

// How fast each product sells over the counter (walk-ins), units per average day.
const POS_RATES: [RegExp, number][] = [
  [/marine plywood/i, 0.25], [/plywood/i, 0.7], [/cement/i, 2.6], [/sand|gravel/i, 3], [/steel bar|deformed/i, 1.8],
  [/tie wire/i, 0.9], [/nail/i, 1.5], [/thhn|flat cord/i, 7], [/wire .*\(50m\)/i, 0.15], [/switch|outlet/i, 0.8],
  [/led bulb/i, 1.3], [/fluorescent/i, 0.35], [/breaker/i, 0.25], [/screw \d|self-drilling|wood screws/i, 0.55],
  [/hex bolt|anchor bolt/i, 2.4], [/hinge/i, 1.2], [/padlock/i, 0.3], [/door knob/i, 0.15], [/latex|enamel/i, 0.6],
  [/brush/i, 0.7], [/roller/i, 0.35], [/sandpaper/i, 0.6], [/pvc pipe/i, 1.7], [/elbow|tee/i, 3.4], [/gi pipe/i, 0.45],
  [/valve/i, 0.3], [/faucet/i, 0.18], [/shower/i, 0.12], [/drill|grinder|circular saw/i, 0.05], [/helmet/i, 0.18],
  [/gloves/i, 0.65], [/hammer|mallet/i, 0.22], [/screwdriver/i, 0.25], [/tape measure|level/i, 0.2], [/wrench|hacksaw/i, 0.15],
];
const posRateFor = (name: string) => POS_RATES.find(([re]) => re.test(name))?.[1] ?? 0.25;

const COST_SHARE: [RegExp, number][] = [[/cement|sand|gravel|steel|plywood/i, 0.8], [/drill|grinder|saw/i, 0.72], [/nail|screw|bolt|wire/i, 0.68]];
const costShareFor = (name: string) => COST_SHARE.find(([re]) => re.test(name))?.[1] ?? 0.65;
// Made-up supplier names.
const SUPPLIERS: [RegExp, string][] = [
  [/cement|sand|gravel|steel|tie wire|plywood/i, "Island Builders Supply"],
  [/wire|switch|outlet|bulb|lamp|breaker/i, "Eastern Visayas Electrical Trading"],
  [/pipe|elbow|tee|valve|faucet|shower/i, "Leyte Plumbing Depot"],
  [/drill|grinder|saw/i, "Visayas Power Tools Center"],
];
const supplierFor = (name: string) => SUPPLIERS.find(([re]) => re.test(name))?.[1] ?? "Biliran General Hardware Wholesale";

// Each driver covers one side of the island.
const EAST_ROUTE = ["Biliran", "Cabucgayan", "Caibiran", "Culaba"];
const DEMO_DRIVER = { username: "Rommel Gerona", contact: "09171234501" };

function addressOf(b: Barangay, town: string) {
  return b.name === "Poblacion" ? `Poblacion, ${town}, Biliran` : `Brgy. ${b.name}, ${town}, Biliran`;
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
  const book: AddressBook = JSON.parse(fs.readFileSync(path.join(__dirname, "demo", "biliran-addresses.json"), "utf-8"));
  const towns = Object.keys(book.municipalities);

  const [admin, cashier1, cashier2, driver1] = await Promise.all(["admin", "cashier1", "cashier2", "driver1"].map(userId));
  const products = await prisma.product.findMany({ select: { id: true, name: true, price: true, stock: true }, orderBy: { id: "asc" } });
  if (products.length === 0) throw new Error("No products found. Run the normal seed first.");
  const productFor = (re: RegExp) => products.find((p) => re.test(p.name));

  const marker: Marker = { addedAt: NOW.toISOString(), userIds: [], orderIds: [], transactionIds: [], restockIds: [], stock: {}, storeSettings: {} };
  const soldRecent = new Map<number, number>(products.map((p) => [p.id, 0]));
  const soldAll = new Map<number, number>(products.map((p) => [p.id, 0]));
  const recentFrom = dayAt(EOQ_WINDOW, 0, 0);
  const countSale = (when: Date, lines: { productId: number; quantity: number }[]) => {
    for (const l of lines) {
      soldAll.set(l.productId, (soldAll.get(l.productId) ?? 0) + l.quantity);
      if (when >= recentFrom) soldRecent.set(l.productId, (soldRecent.get(l.productId) ?? 0) + l.quantity);
    }
  };
  // Staff on shift: cashier1 most days, cashier2 on Tuesdays, Thursdays and Saturdays.
  const staffOn = (d: Date) => ([2, 4, 6].includes(d.getDay()) ? cashier2 : cashier1);

  // 1. The store pin, at the building nearest the centre of Brgy. Sanggalang, Biliran.
  const sanggalang = book.municipalities.Biliran.find((b) => b.name === "Sanggalang");
  const storeRows = await prisma.setting.findMany({ where: { key: { in: ["store_lat", "store_lng"] } } });
  for (const key of ["store_lat", "store_lng"]) marker.storeSettings[key] = storeRows.find((r) => r.key === key)?.value ?? null;
  let store: Home = [11.482165, 124.493759];
  if (sanggalang) {
    const centre: Home = [sanggalang.lat, sanggalang.lng];
    store = [...sanggalang.homes].sort((a, b) => km(a, centre) - km(b, centre))[0];
  }
  for (const [key, value] of [["store_lat", store[0]], ["store_lng", store[1]]] as const) {
    await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
  }

  // 2. Accounts: a second driver, and ten customers in every town.
  const existing = new Set((await prisma.user.findMany({ select: { username: true } })).map((u) => u.username));
  if (existing.has(DEMO_DRIVER.username)) throw new Error(`An account named "${DEMO_DRIVER.username}" already exists.`);
  const westDriverUser = await prisma.user.create({
    data: { username: DEMO_DRIVER.username, password: await bcrypt.hash("driver123", 10), role: "driver", contact: DEMO_DRIVER.contact, createdAt: dayAt(200, 9) },
  });
  const westDriver = westDriverUser.id;
  marker.userIds.push(westDriver);

  type Customer = { id: number; name: string; contact: string; town: string; barangay: Barangay; home: Home; kind: string; weight: number };
  const password = await bcrypt.hash("customer123", 10);
  const customers: Customer[] = [];
  const usedNames = new Set(existing);
  const usedHomes = new Set<string>();
  for (const town of towns) {
    const brgys = book.municipalities[town];
    for (let i = 0; i < CUSTOMERS_PER_TOWN; i++) {
      let name = "";
      do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (usedNames.has(name));
      usedNames.add(name);
      // Spread customers over the town's barangays, the town centre a little more often.
      const barangay = weighted(brgys.map((b) => [b, b.name === "Poblacion" || b.name === "Culaba Central" ? 2.5 : 1] as [Barangay, number]));
      let home: Home = pick(barangay.homes);
      for (let tries = 0; tries < 20 && usedHomes.has(home.join()); tries++) home = pick(barangay.homes);
      usedHomes.add(home.join());
      const kind = i === 0 ? "construction" : i < 3 ? "repair" : "household"; // one builder, two fix-it regulars per town
      const contact = `09${int(15, 99)}${int(1000000, 9999999)}`;
      const u = await prisma.user.create({
        data: { username: name, password, role: "customer", contact, createdAt: dayAt(int(ORDER_DAYS + 5, 240), int(8, 20)) },
      });
      marker.userIds.push(u.id);
      customers.push({ id: u.id, name, contact, town, barangay, home, kind, weight: i === 0 ? 3 : i < 3 ? 2 : 1 });
    }
  }

  // 3. Online orders: 50 deliveries per town.
  type Planned = { town: string; status: string; when: Date };
  const planned: Planned[] = [];
  // Today's live orders, in towns close enough for a same-day run.
  const live: [string, string, number][] = [
    ["Naval", "out_for_delivery", 1.5], ["Cabucgayan", "out_for_delivery", 2],
    ["Biliran", "confirmed", 2.5], ["Caibiran", "confirmed", 3],
    ["Naval", "pending", 0.3], ["Biliran", "pending", 0.8], ["Almeria", "pending", 1.2],
  ];
  for (const town of towns) {
    const today = live.filter(([t]) => t === town);
    for (const [, status, hoursAgo] of today) planned.push({ town, status, when: new Date(NOW.getTime() - hoursAgo * 3600000) });
    for (let i = today.length; i < ORDERS_PER_TOWN; i++) {
      const daysAgo = 1 + Math.floor(Math.pow(rand(), 1.35) * (ORDER_DAYS - 1)); // a bit busier lately
      planned.push({ town, status: rand() < 0.05 ? "cancelled" : "delivered", when: dayAt(daysAgo, int(7, 16)) });
    }
  }
  planned.sort((a, b) => a.when.getTime() - b.when.getTime());
  const allHomes = Object.values(book.municipalities).flat().flatMap((b) => b.homes);

  for (const plan of planned) {
    const local = customers.filter((c) => c.town === plan.town);
    const c = weighted(local.map((x) => [x, x.weight] as [Customer, number]));
    const kitName = c.kind === "construction" ? weighted([["construction", 4], ["repair", 1]])
      : c.kind === "repair" ? weighted([["repair", 3], ["household", 1]])
      : weighted([["household", 6], ["repair", 1]]);
    const kit = KITS[kitName];
    const items = shuffled(kit.lines).slice(0, int(kit.pickMin, kit.pickMax))
      .map(([re, lo, hi]) => ({ p: productFor(re), q: int(lo, hi) }))
      .filter((x): x is { p: (typeof products)[number]; q: number } => !!x.p)
      .map(({ p, q }) => ({ productId: p.id, productName: p.name, quantity: q, price: p.price }));
    if (items.length === 0) throw new Error(`No products match the "${kitName}" list; the demo expects the sample catalogue.`);
    const total = round2(items.reduce((s, i) => s + i.price * i.quantity, 0));
    const gcash = rand() < (total > 3000 ? 0.5 : 0.3);
    const handler = staffOn(plan.when);
    const driver = EAST_ROUTE.includes(plan.town) ? driver1 : westDriver;
    const tripKm = km(store, c.home);

    const confirmedAt = addMinutes(plan.when, int(10, 60));
    const assignedAt = addMinutes(confirmedAt, int(30, 150));
    // Maripipi is an island: its deliveries go over on the next boat, a day later.
    const deliveredAt = notAfterNow(plan.town === "Maripipi"
      ? new Date(assignedAt.getTime() + int(20, 30) * 3600000)
      : addMinutes(assignedAt, Math.round(tripKm * 3 + int(15, 60))));

    let saleId: number | null = null;
    if (plan.status === "delivered") {
      const sale = await prisma.transaction.create({
        data: { userId: handler, totalAmount: total, paymentMethod: gcash ? "GCash" : "Cash", type: "Online", dateTime: deliveredAt, items: { create: items } },
      });
      saleId = sale.id;
      marker.transactionIds.push(sale.id);
      countSale(deliveredAt, items);
    }

    const out = plan.status === "out_for_delivery";
    let driverPos: Home | null = null;
    if (out) {
      // The driver is partway there: the house most directly on the way, 40–70% into the trip.
      const onTheWay = allHomes
        .filter((h) => { const f = km(store, h) / tripKm; return f > 0.4 && f < 0.7; })
        .sort((a, b) => (km(store, a) + km(a, c.home)) - (km(store, b) + km(b, c.home)));
      driverPos = onTheWay[0] ?? null;
    }
    const withDriver = plan.status === "delivered" || out;
    const order = await prisma.order.create({
      data: {
        customerId: c.id,
        status: plan.status,
        totalAmount: total,
        dateTime: plan.when,
        fulfillmentMode: "delivery",
        paymentMethod: gcash ? "GCash" : "Cash",
        gcashNumber: gcash ? c.contact : null,
        gcashReference: gcash ? `${int(1000, 9999)}${int(100000000, 999999999)}` : null,
        paymentVerified: gcash && plan.status !== "pending",
        amountPaid: gcash || plan.status === "delivered" ? total : 0,
        deliveryAddress: addressOf(c.barangay, c.town),
        latitude: c.home[0],
        longitude: c.home[1],
        driverId: withDriver ? driver : null,
        assignedAt: withDriver ? (out ? new Date(NOW.getTime() - int(25, 50) * 60000) : assignedAt) : null,
        driverLat: driverPos ? driverPos[0] : null,
        driverLng: driverPos ? driverPos[1] : null,
        driverLocationUpdatedAt: driverPos ? new Date(NOW.getTime() - 40000) : null,
        handledById: plan.status === "pending" ? null : handler,
        transactionId: saleId,
        items: { create: items.map(({ productId, quantity, price }) => ({ productId, quantity, price })) },
      },
    });
    marker.orderIds.push(order.id);
  }

  // 4. Walk-in counter sales for six months.
  let posCount = 0;
  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const weekday = dayAt(daysAgo, 0, 0).getDay();
    const dayFactor = weekday === 0 ? 0.5 : weekday === 6 ? 1.3 : 1;
    const trend = 0.8 + 0.4 * ((HISTORY_DAYS - daysAgo) / HISTORY_DAYS);
    const lines = shuffled(products
      .map((p) => ({ p, q: poisson(posRateFor(p.name) * dayFactor * trend) }))
      .filter((x) => x.q > 0)
      .map(({ p, q }) => ({ productId: p.id, productName: p.name, quantity: q, price: p.price })));
    for (let i = 0; i < lines.length; ) {
      const size = 1 + Math.floor(rand() * 3);
      const basket = lines.slice(i, i + size);
      i += size;
      let when = dayAt(daysAgo, int(7, 17));
      if (when > NOW) when = new Date(NOW.getTime() - int(5, 240) * 60000);
      const total = round2(basket.reduce((s, l) => s + l.price * l.quantity, 0));
      const sale = await prisma.transaction.create({
        data: { userId: staffOn(when), totalAmount: total, paymentMethod: rand() < 0.78 ? "Cash" : "GCash", type: "POS", dateTime: when, items: { create: basket } },
      });
      marker.transactionIds.push(sale.id);
      countSale(when, basket);
      posCount++;
    }
  }

  // 5. Stock levels and supplier purchases.
  const fast = products.filter((p) => (soldRecent.get(p.id) ?? 0) / EOQ_WINDOW >= 0.8).map((p) => p.id);
  const outIds = new Set(fast.filter((_, i) => i % 9 === 4).slice(0, 3));
  const reorderIds = new Set(fast.filter((id, i) => i % 5 === 1 && !outIds.has(id)).slice(0, 6));
  let restockCount = 0;
  for (const p of products) {
    const daily = (soldRecent.get(p.id) ?? 0) / EOQ_WINDOW;
    const unitCost = Math.round(p.price * costShareFor(p.name) * 2) / 2;
    const eoq = daily > 0 ? Math.max(1, Math.ceil(Math.sqrt((2 * daily * 365 * ORDER_COST) / (unitCost * HOLDING_RATE)))) : 5;
    const rop = daily > 0 ? Math.max(1, Math.ceil(daily * COVER_DAYS)) : 5;
    const target = outIds.has(p.id) ? 0
      : reorderIds.has(p.id) ? Math.max(1, Math.floor(rop * between(0.35, 0.95)))
      : rop + Math.max(1, Math.round(eoq * between(0.5, 1.3)));
    marker.stock[p.id] = { before: p.stock, set: target };
    await prisma.product.update({ where: { id: p.id }, data: { stock: target } });

    // Roughly one EOQ-sized purchase each time stock ran low.
    const bought = (soldAll.get(p.id) ?? 0) + target;
    const count = Math.min(10, Math.max(1, Math.round(bought / Math.max(eoq, 1))));
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.max(2, Math.round(HISTORY_DAYS - 4 - (i + rand() * 0.7) * ((HISTORY_DAYS - 8) / count)));
      const quantity = bought / count >= 50 ? Math.ceil(bought / count / 10) * 10 : Math.max(1, Math.ceil(bought / count));
      const cost = round2(unitCost * between(0.97, 1.03));
      const r = await prisma.restock.create({
        data: {
          productId: p.id, quantity, unitCost: cost, totalCost: round2(quantity * cost), supplierName: supplierFor(p.name),
          note: `DR No. ${int(10000, 99999)}`, date: dayAt(daysAgo, int(8, 10)), recordedById: rand() < 0.5 ? admin : cashier1,
        },
      });
      marker.restockIds.push(r.id);
      restockCount++;
    }
  }

  await prisma.setting.create({ data: { key: MARKER_KEY, value: JSON.stringify(marker) } });

  const statusCounts = await prisma.order.groupBy({ by: ["status"], where: { id: { in: marker.orderIds } }, _count: true });
  console.log(`✓ Store pin set to Brgy. Sanggalang, Biliran (${store[0]}, ${store[1]})`);
  console.log(`✓ ${customers.length} customers (${CUSTOMERS_PER_TOWN} per town, password customer123) and driver "${DEMO_DRIVER.username}" (password driver123)`);
  console.log(`✓ ${marker.orderIds.length} delivery orders, ${ORDERS_PER_TOWN} per town: ${statusCounts.map((s) => `${s._count} ${s.status}`).join(", ")}`);
  console.log(`✓ ${posCount} walk-in counter sales over ${HISTORY_DAYS} days`);
  console.log(`✓ ${restockCount} supplier purchases; ${outIds.size} products out of stock, ${reorderIds.size} at their reorder point`);
  console.log(`  Sample customer logins: ${towns.map((t) => `${customers.find((c) => c.town === t)!.name} (${t})`).join(", ")}`);
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
  const userIds = m.userIds ?? [];

  await prisma.$transaction(async (tx) => {
    // Every order of a demo customer goes, including any placed while trying the demo.
    const extra = await tx.order.findMany({ where: { customerId: { in: userIds } }, select: { id: true } });
    const orderIds = [...new Set([...m.orderIds, ...extra.map((o) => o.id)])];
    await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    // Real orders linked to a demo sale, or assigned to the demo driver, are kept but unlinked.
    await tx.order.updateMany({ where: { transactionId: { in: m.transactionIds } }, data: { transactionId: null } });
    await tx.order.updateMany({ where: { driverId: { in: userIds } }, data: { driverId: null } });
    await tx.transactionItem.deleteMany({ where: { transactionId: { in: m.transactionIds } } });
    await tx.transaction.deleteMany({ where: { id: { in: m.transactionIds } } });
    await tx.restock.deleteMany({ where: { id: { in: m.restockIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    for (const [id, s] of Object.entries(m.stock)) {
      await tx.product.updateMany({ where: { id: Number(id) }, data: { stock: { increment: round2(s.before - s.set) } } });
    }
    for (const [key, value] of Object.entries(m.storeSettings ?? {})) {
      if (value == null) await tx.setting.deleteMany({ where: { key } });
      else await tx.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    await tx.setting.delete({ where: { key: MARKER_KEY } });
  }, { timeout: 180000 });

  console.log(`✓ Removed ${m.orderIds.length} orders, ${m.transactionIds.length} sales, ${m.restockIds.length} purchases and ${userIds.length} demo accounts; restored stock and the store pin.`);
}

(process.argv.includes("--remove") ? remove() : add())
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
