// Tidies the product catalogue: merges duplicate categories and subcategories,
// gives every category a description, fixes units on bulk goods, and merges
// products that were entered twice.
//
//   node scripts/tidy-catalog.mjs          shows what would change (nothing is saved)
//   node scripts/tidy-catalog.mjs --apply  makes the changes
//
// Safe to run more than once: every step looks things up by name and skips
// what's already done. Back up the database first (pg_dump) — merging products
// moves their sales history onto the product that stays.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const log = (...a) => console.log(APPLY ? "  ✓" : "  ·", ...a);

/** The categories the store ends up with, and what each holds. */
const CATEGORY_PLAN = [
  { name: "Construction", description: "Cement, steel bars, aggregates, lumber and plywood", from: ["Construction"] },
  { name: "Electrical", description: "Wires, switches, outlets, breakers and lighting", from: ["Electrical"] },
  { name: "Fasteners", description: "Nails, screws, bolts, nuts and anchors", from: ["Fasteners"] },
  { name: "Plumbing", description: "Pipes, fittings, valves and fixtures", from: ["Plumbing"] },
  { name: "Hand Tools", description: "Hammers, screwdrivers, wrenches and saws", from: ["Hand Tools", "Tools"] },
  { name: "Power Tools", description: "Drills, grinders and power saws", from: ["Power Tools"] },
  { name: "Measuring", description: "Tape measures, levels and squares", from: ["Measuring"] },
  { name: "Paint & Finishing", description: "Paint, brushes, rollers and sandpaper", from: ["Painting", "PAINT & FINISHING", "Paint & Finishing"] },
  { name: "Door & Cabinet Hardware", description: "Locks, padlocks, knobs and hinges", from: ["Hardware Accessories", "Door & Cabinet Hardware"] },
  { name: "Safety", description: "Gloves, hard hats, goggles and other safety gear", from: ["Safety"] },
];

/** Products that move to another category, by their current [category, subcategory]. */
const MOVES = [
  { from: ["Wood & Carpentry", "Lumber"], to: ["Construction", "Lumber & Plywood"] },
  { from: ["Wood & Carpentry", "Wood Accessories"], to: ["Fasteners", "Screws"] },
  { from: ["Construction", "Nails & fastener"], to: ["Fasteners", "Nails"] },
  { from: ["Hand Tools", "Measuring Tools"], to: ["Measuring", null] }, // sorted below by name
];

/** Subcategory renames and merges inside a category: old name → new name. */
const SUB_RENAMES = {
  Construction: { "Steel": "Steel & Rebar", "Steel & rebar": "Steel & Rebar", "Aggregate": "Aggregates", "Lumber": "Lumber & Plywood" },
  Electrical: { "Wires": "Wires & Cables", "Wires & cable": "Wires & Cables", "Outlets & Switches": "Switches & Outlets" },
  "Paint & Finishing": { "Tools": "Brushes & Rollers", "Rollers": "Brushes & Rollers" },
  "Power Tools": { "Cutting Tools": "Cutting" },
};

/** Products in a catch-all subcategory that belong in a specific one, by name. */
const SUB_BY_NAME = [
  { category: "Hand Tools", sub: "Basic Tools", rules: [[/hammer/i, "Hammers"], [/screwdriver/i, "Screwdrivers"]] },
  { category: "Measuring", sub: null, rules: [[/tape/i, "Tape Measures"], [/level/i, "Levels"]] },
];

/** The same item entered twice: [keep, merge into it]. Prices match or nearly do. */
const DUPLICATES = [
  ["Claw Hammer 16oz", "Claw Hammer"],
  ["Tape Measure 5m", "Tape Measure (5m)"],
  ['Spirit Level 24"', "Spirit Level"],
  ['Paint Roller 7"', "Paint Roller"],
  ['PVC Elbow 1/2"', "Elbow 1/2 PVC"],
  ["Portland Cement (40kg)", "Portland Cement 40kg"],
];

/** Bulk goods sold by the sack or bag, not "pc"; and names that repeat the unit. */
const UNIT_FIXES = [
  { name: "Gravel 3/4 (per sack)", rename: 'Gravel 3/4"', unit: "sack" },
  { name: "Washed Sand (per sack)", rename: "Washed Sand", unit: "sack" },
  { name: "Portland Cement (40kg)", rename: "Portland Cement 40kg", unit: "bag" },
  { name: "Rapid Hardening Cement", unit: "bag" },
];

async function category(name) {
  return prisma.category.findFirst({ where: { name } });
}

async function subcategory(categoryId, name) {
  if (!name) return null;
  const found = await prisma.subcategory.findFirst({ where: { categoryId, name } });
  if (found || !APPLY) return found ?? { id: -1, name };
  return prisma.subcategory.create({ data: { categoryId, name } });
}

async function main() {
  console.log(APPLY ? "Tidying the catalogue…" : "Dry run — nothing is saved. Add --apply to make these changes.\n");

  // 1. Categories: keep one per group, move products and subcategories into it.
  console.log("Categories");
  for (const plan of CATEGORY_PLAN) {
    const sources = (await prisma.category.findMany({ where: { name: { in: plan.from } } }));
    if (sources.length === 0) continue;
    const keep = sources.find((c) => c.name === plan.name) ?? sources[0];
    if (keep.name !== plan.name || keep.description !== plan.description) {
      log(keep.name === plan.name ? `"${plan.name}": description updated` : `"${keep.name}" → "${plan.name}"`);
      if (APPLY) await prisma.category.update({ where: { id: keep.id }, data: { name: plan.name, description: plan.description } });
    }
    for (const other of sources.filter((c) => c.id !== keep.id)) {
      const subs = await prisma.subcategory.findMany({ where: { categoryId: other.id } });
      for (const s of subs) {
        const target = await subcategory(keep.id, s.name);
        log(`  ${other.name} › ${s.name} → ${plan.name} › ${s.name}`);
        if (APPLY) {
          await prisma.product.updateMany({ where: { subcategoryId: s.id }, data: { subcategoryId: target.id, categoryId: keep.id } });
          await prisma.subcategory.delete({ where: { id: s.id } });
        }
      }
      if (APPLY) {
        await prisma.product.updateMany({ where: { categoryId: other.id }, data: { categoryId: keep.id } });
        await prisma.category.delete({ where: { id: other.id } });
      }
      log(`  removed the duplicate category "${other.name}"`);
    }
  }

  // 2. Products that belong elsewhere.
  console.log("\nMoves");
  for (const m of MOVES) {
    const fromCat = await category(m.from[0]);
    const toCat = await category(m.to[0]);
    if (!fromCat || !toCat) continue;
    const fromSub = await prisma.subcategory.findFirst({ where: { categoryId: fromCat.id, name: m.from[1] } });
    if (!fromSub) continue;
    const toSub = await subcategory(toCat.id, m.to[1]);
    const items = await prisma.product.findMany({ where: { subcategoryId: fromSub.id }, select: { name: true } });
    log(`${m.from.join(" › ")} (${items.map((i) => i.name).join(", ")}) → ${m.to.filter(Boolean).join(" › ")}`);
    if (APPLY) {
      await prisma.product.updateMany({ where: { subcategoryId: fromSub.id }, data: { categoryId: toCat.id, subcategoryId: toSub?.id ?? null } });
      await prisma.subcategory.delete({ where: { id: fromSub.id } });
    }
  }
  const wood = await category("Wood & Carpentry");
  if (wood && (await prisma.product.count({ where: { categoryId: wood.id } })) === 0) {
    log('removed the now-empty category "Wood & Carpentry"');
    if (APPLY) { await prisma.subcategory.deleteMany({ where: { categoryId: wood.id } }); await prisma.category.delete({ where: { id: wood.id } }); }
  }

  // 3. Subcategory names.
  console.log("\nSubcategories");
  for (const [catName, renames] of Object.entries(SUB_RENAMES)) {
    const cat = await category(catName);
    if (!cat) continue;
    for (const [from, to] of Object.entries(renames)) {
      const src = await prisma.subcategory.findFirst({ where: { categoryId: cat.id, name: from } });
      if (!src || from === to) continue;
      const target = await prisma.subcategory.findFirst({ where: { categoryId: cat.id, name: to } });
      log(`${catName} › "${from}" → "${to}"`);
      if (!APPLY) continue;
      if (target) {
        await prisma.product.updateMany({ where: { subcategoryId: src.id }, data: { subcategoryId: target.id } });
        await prisma.subcategory.delete({ where: { id: src.id } });
      } else {
        await prisma.subcategory.update({ where: { id: src.id }, data: { name: to } });
      }
    }
  }
  for (const rule of SUB_BY_NAME) {
    const cat = await category(rule.category);
    if (!cat) continue;
    const src = rule.sub ? await prisma.subcategory.findFirst({ where: { categoryId: cat.id, name: rule.sub } }) : null;
    if (rule.sub && !src) continue;
    const items = await prisma.product.findMany({ where: { categoryId: cat.id, subcategoryId: src ? src.id : null } });
    for (const it of items) {
      const hit = rule.rules.find(([re]) => re.test(it.name));
      if (!hit) continue;
      const target = await subcategory(cat.id, hit[1]);
      log(`${it.name} → ${rule.category} › ${hit[1]}`);
      if (APPLY) await prisma.product.update({ where: { id: it.id }, data: { subcategoryId: target.id } });
    }
    if (src && APPLY && (await prisma.product.count({ where: { subcategoryId: src.id } })) === 0) await prisma.subcategory.delete({ where: { id: src.id } });
  }

  // 4. Duplicate products: stock, sales and purchase history move to the one that stays.
  console.log("\nDuplicate products");
  for (const [keepName, dupName] of DUPLICATES) {
    const keep = await prisma.product.findFirst({ where: { name: keepName } });
    const dup = await prisma.product.findFirst({ where: { name: dupName } });
    if (!keep || !dup || keep.id === dup.id) continue;
    log(`"${dupName}" (${dup.stock} ${dup.unit}) merged into "${keepName}" (${keep.stock} ${keep.unit})`);
    if (!APPLY) continue;
    await prisma.$transaction([
      prisma.orderItem.updateMany({ where: { productId: dup.id }, data: { productId: keep.id } }),
      prisma.transactionItem.updateMany({ where: { productId: dup.id }, data: { productId: keep.id } }),
      prisma.restock.updateMany({ where: { productId: dup.id }, data: { productId: keep.id } }),
      prisma.stockAdjustment.updateMany({ where: { productId: dup.id }, data: { productId: keep.id } }),
      prisma.product.update({ where: { id: keep.id }, data: { stock: { increment: Math.max(0, dup.stock) }, image: keep.image ?? dup.image } }),
      prisma.product.delete({ where: { id: dup.id } }),
    ]);
  }

  // 5. Units and names for bulk goods.
  console.log("\nUnits");
  for (const f of UNIT_FIXES) {
    const p = await prisma.product.findFirst({ where: { name: f.name } });
    if (!p) continue;
    if (p.unit === f.unit && !f.rename) continue;
    log(`${f.name}${f.rename ? ` → "${f.rename}"` : ""}: sold per ${f.unit}`);
    if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { unit: f.unit, ...(f.rename ? { name: f.rename } : {}) } });
  }

  // 6. Placeholder stock photos from the original demo data: a power drill on the
  // hammers, a house painter on the nails, a broken link on the PVC pipes. A wrong
  // picture is worse than none (the card shows the category icon instead).
  // Photos the store uploaded itself (/uploads, /api/uploads) are kept.
  console.log("\nPhotos");
  const stock = await prisma.product.findMany({ where: { image: { startsWith: "https://images.unsplash.com/" } }, select: { id: true, name: true } });
  if (stock.length) {
    log(`removed placeholder stock photos from ${stock.length} products: ${stock.map((x) => x.name).join(", ")}`);
    if (APPLY) await prisma.product.updateMany({ where: { id: { in: stock.map((x) => x.id) } }, data: { image: null } });
  }

  // 7. Empty subcategories left behind.
  const empty = await prisma.subcategory.findMany({ where: { products: { none: {} } } });
  if (empty.length) {
    log(`removed ${empty.length} empty subcategor${empty.length === 1 ? "y" : "ies"}: ${empty.map((s) => s.name).join(", ")}`);
    if (APPLY) await prisma.subcategory.deleteMany({ where: { id: { in: empty.map((s) => s.id) } } });
  }

  console.log(APPLY ? "\nDone." : "\nDry run finished.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
