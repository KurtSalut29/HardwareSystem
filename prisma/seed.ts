import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Users
  const users = [
    { username: "admin", password: "admin123", role: "admin", contact: "09001112222" },
    { username: "cashier1", password: "cashier123", role: "cashier", contact: "09003334444" },
    { username: "cashier2", password: "cashier123", role: "cashier", contact: "09003335555" },
    { username: "customer1", password: "customer123", role: "customer", contact: "09005556666" },
    { username: "customer2", password: "customer123", role: "customer", contact: "09005557777" },
  ];

  const createdUsers: Record<string, number> = {};
  for (const user of users) {
    const hashed = await bcrypt.hash(user.password, 10);
    const u = await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: { ...user, password: hashed },
    });
    createdUsers[user.username] = u.id;
    console.log(`✓ User: ${user.username} (${user.role})`);
  }

  // Categories
  const categories = [
    { name: "Fasteners", description: "Nails, screws, bolts, nuts, and anchors" },
    { name: "Tools", description: "Hand tools and power tool accessories" },
    { name: "Plumbing", description: "Pipes, fittings, valves, and fixtures" },
    { name: "Electrical", description: "Wires, switches, breakers, and conduits" },
    { name: "Construction", description: "Cement, steel, lumber, and aggregates" },
    { name: "Painting", description: "Paints, primers, brushes, and rollers" },
    { name: "Measuring", description: "Tape measures, levels, and squares" },
    { name: "Safety", description: "Gloves, helmets, goggles, and safety gear" },
  ];

  const catIds: Record<string, number> = {};
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    catIds[cat.name] = c.id;
    console.log(`✓ Category: ${cat.name}`);
  }

  // Products
  const products = [
    // Fasteners
    { name: "Common Wire Nail 2\"", categoryId: catIds["Fasteners"], subcategory: "Nails", price: 35, stock: 500, unit: "kg", description: "Standard common wire nail, 2 inch", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80" },
    { name: "Common Wire Nail 3\"", categoryId: catIds["Fasteners"], subcategory: "Nails", price: 40, stock: 450, unit: "kg", description: "Standard common wire nail, 3 inch", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80" },
    { name: "Roofing Nail 1.5\"", categoryId: catIds["Fasteners"], subcategory: "Nails", price: 55, stock: 300, unit: "kg", description: "Galvanized roofing nail with large flat head", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80" },
    { name: "Concrete Nail 2\"", categoryId: catIds["Fasteners"], subcategory: "Nails", price: 60, stock: 200, unit: "kg", description: "Hardened steel nail for concrete", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80" },
    { name: "Wood Screw 1\" (100pcs)", categoryId: catIds["Fasteners"], subcategory: "Screws", price: 75, stock: 150, unit: "pack", description: "Phillips head wood screw, 1 inch", image: null },
    { name: "Wood Screw 2\" (100pcs)", categoryId: catIds["Fasteners"], subcategory: "Screws", price: 95, stock: 120, unit: "pack", description: "Phillips head wood screw, 2 inch", image: null },
    { name: "Self-Drilling Screw (100pcs)", categoryId: catIds["Fasteners"], subcategory: "Screws", price: 110, stock: 100, unit: "pack", description: "Tek screw for metal to metal", image: null },
    { name: "Hex Bolt M10x50", categoryId: catIds["Fasteners"], subcategory: "Bolts & Nuts", price: 25, stock: 200, unit: "pc", description: "Hex bolt with nut, M10 x 50mm", image: null },
    { name: "Anchor Bolt 3/8\"", categoryId: catIds["Fasteners"], subcategory: "Anchors", price: 18, stock: 300, unit: "pc", description: "Expansion anchor bolt for concrete", image: null },

    // Tools
    { name: "Claw Hammer 16oz", categoryId: catIds["Tools"], subcategory: "Hammers", price: 250, stock: 45, unit: "pc", description: "Steel claw hammer, 16 oz", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&q=80" },
    { name: "Rubber Mallet", categoryId: catIds["Tools"], subcategory: "Hammers", price: 180, stock: 30, unit: "pc", description: "Rubber mallet for tile and woodwork", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&q=80" },
    { name: "Flathead Screwdriver 6\"", categoryId: catIds["Tools"], subcategory: "Screwdrivers", price: 85, stock: 60, unit: "pc", description: "Flathead screwdriver, 6 inch", image: null },
    { name: "Phillips Screwdriver #2", categoryId: catIds["Tools"], subcategory: "Screwdrivers", price: 90, stock: 55, unit: "pc", description: "Phillips #2 screwdriver", image: null },
    { name: "Adjustable Wrench 10\"", categoryId: catIds["Tools"], subcategory: "Wrenches", price: 320, stock: 30, unit: "pc", description: "Adjustable wrench, 10 inch", image: null },
    { name: "Hacksaw", categoryId: catIds["Tools"], subcategory: "Saws", price: 220, stock: 25, unit: "pc", description: "Hacksaw with 12-inch blade", image: null },

    // Plumbing
    { name: "PVC Pipe 1/2\" x 3m", categoryId: catIds["Plumbing"], subcategory: "Pipes", price: 85, stock: 200, unit: "length", description: "PVC pressure pipe, 1/2 inch x 3 meters", image: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&q=80" },
    { name: "PVC Pipe 3/4\" x 3m", categoryId: catIds["Plumbing"], subcategory: "Pipes", price: 110, stock: 150, unit: "length", description: "PVC pressure pipe, 3/4 inch x 3 meters", image: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&q=80" },
    { name: "PVC Elbow 1/2\"", categoryId: catIds["Plumbing"], subcategory: "Fittings", price: 12, stock: 300, unit: "pc", description: "PVC 90-degree elbow, 1/2 inch", image: null },
    { name: "Gate Valve 1/2\"", categoryId: catIds["Plumbing"], subcategory: "Valves", price: 120, stock: 80, unit: "pc", description: "Brass gate valve, 1/2 inch", image: null },
    { name: "Ball Valve 3/4\"", categoryId: catIds["Plumbing"], subcategory: "Valves", price: 185, stock: 60, unit: "pc", description: "Brass ball valve, 3/4 inch", image: null },

    // Electrical
    { name: "Electrical Wire 2.0mm (50m)", categoryId: catIds["Electrical"], subcategory: "Wires", price: 850, stock: 40, unit: "roll", description: "THHN copper wire, 2.0mm, 50 meters", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=80" },
    { name: "Electrical Wire 3.5mm (50m)", categoryId: catIds["Electrical"], subcategory: "Wires", price: 1350, stock: 25, unit: "roll", description: "THHN copper wire, 3.5mm, 50 meters", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=80" },
    { name: "Circuit Breaker 20A", categoryId: catIds["Electrical"], subcategory: "Breakers", price: 350, stock: 25, unit: "pc", description: "Single pole circuit breaker, 20A", image: null },
    { name: "Outlet (3-gang)", categoryId: catIds["Electrical"], subcategory: "Outlets & Switches", price: 95, stock: 80, unit: "pc", description: "3-gang universal outlet", image: null },

    // Construction
    { name: "Portland Cement 40kg", categoryId: catIds["Construction"], subcategory: "Cement", price: 280, stock: 100, unit: "sack", description: "Type I Portland cement, 40kg bag", image: "https://images.unsplash.com/photo-1590496793929-36417d3117de?w=400&q=80" },
    { name: "Steel Bar 10mm x 6m", categoryId: catIds["Construction"], subcategory: "Steel", price: 420, stock: 60, unit: "length", description: "Deformed steel bar, 10mm x 6 meters", image: null },
    { name: "Steel Bar 12mm x 6m", categoryId: catIds["Construction"], subcategory: "Steel", price: 580, stock: 40, unit: "length", description: "Deformed steel bar, 12mm x 6 meters", image: null },
    { name: "Plywood 1/4\" 4x8", categoryId: catIds["Construction"], subcategory: "Lumber", price: 480, stock: 30, unit: "sheet", description: "Marine plywood, 1/4 inch, 4x8 feet", image: null },

    // Painting
    { name: "Paint Brush 2\"", categoryId: catIds["Painting"], subcategory: "Brushes", price: 65, stock: 3, unit: "pc", description: "Flat paint brush, 2 inch", image: null },
    { name: "Paint Roller 7\"", categoryId: catIds["Painting"], subcategory: "Rollers", price: 120, stock: 20, unit: "pc", description: "Paint roller with tray, 7 inch", image: null },
    { name: "Sandpaper 120 Grit (10pcs)", categoryId: catIds["Painting"], subcategory: "Sandpaper", price: 45, stock: 0, unit: "pack", description: "Aluminum oxide sandpaper, 120 grit", image: null },

    // Measuring
    { name: "Tape Measure 5m", categoryId: catIds["Measuring"], subcategory: "Tape Measures", price: 150, stock: 40, unit: "pc", description: "Steel tape measure, 5 meters", image: null },
    { name: "Spirit Level 24\"", categoryId: catIds["Measuring"], subcategory: "Levels", price: 280, stock: 20, unit: "pc", description: "Aluminum spirit level, 24 inch", image: null },

    // Safety
    { name: "Safety Helmet", categoryId: catIds["Safety"], subcategory: "Head Protection", price: 220, stock: 15, unit: "pc", description: "Hard hat, ANSI certified", image: null },
    { name: "Safety Gloves (pair)", categoryId: catIds["Safety"], subcategory: "Hand Protection", price: 85, stock: 50, unit: "pair", description: "Cut-resistant work gloves", image: null },
  ];

  const createdProducts: Record<string, number> = {};
  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    let p;
    if (existing) {
      p = await prisma.product.update({ where: { id: existing.id }, data: { stock: product.stock, price: product.price } });
    } else {
      p = await prisma.product.create({ data: product });
    }
    createdProducts[product.name] = p.id;
    console.log(`✓ Product: ${product.name}`);
  }

  // Transactions
  const cashierId = createdUsers["cashier1"];
  const txData = [
    { items: [{ name: "Claw Hammer 16oz", qty: 2 }, { name: "Flathead Screwdriver 6\"", qty: 1 }], payment: "Cash" },
    { items: [{ name: "PVC Pipe 1/2\" x 3m", qty: 5 }, { name: "Gate Valve 1/2\"", qty: 2 }], payment: "GCash" },
    { items: [{ name: "Portland Cement 40kg", qty: 3 }], payment: "Cash" },
    { items: [{ name: "Electrical Wire 2.0mm (50m)", qty: 2 }, { name: "Circuit Breaker 20A", qty: 1 }], payment: "Card" },
    { items: [{ name: "Tape Measure 5m", qty: 1 }, { name: "Spirit Level 24\"", qty: 1 }], payment: "Cash" },
    { items: [{ name: "Common Wire Nail 2\"", qty: 10 }, { name: "Wood Screw 2\" (100pcs)", qty: 3 }], payment: "Cash" },
  ];

  for (const tx of txData) {
    const items = tx.items.map((i) => {
      const prod = products.find((p) => p.name === i.name)!;
      return { productId: createdProducts[i.name], quantity: i.qty, price: prod.price, productName: i.name };
    });
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    await prisma.transaction.create({
      data: {
        userId: cashierId,
        totalAmount: total,
        paymentMethod: tx.payment,
        type: "POS",
        dateTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        items: { create: items },
      },
    });
  }
  console.log("✓ Transactions seeded");

  // Orders
  const customerId = createdUsers["customer1"];
  const orderData = [
    { items: [{ name: "Wood Screw 2\" (100pcs)", qty: 2 }, { name: "Paint Brush 2\"", qty: 3 }], status: "delivered" },
    { items: [{ name: "Steel Bar 10mm x 6m", qty: 2 }], status: "confirmed" },
    { items: [{ name: "Adjustable Wrench 10\"", qty: 1 }, { name: "Phillips Screwdriver #2", qty: 2 }], status: "pending" },
  ];

  for (const order of orderData) {
    const items = order.items.map((i) => {
      const prod = products.find((p) => p.name === i.name)!;
      return { productId: createdProducts[i.name], quantity: i.qty, price: prod.price };
    });
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    await prisma.order.create({
      data: {
        customerId,
        totalAmount: total,
        status: order.status,
        dateTime: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000),
        items: { create: items },
      },
    });
  }
  console.log("✓ Orders seeded");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
