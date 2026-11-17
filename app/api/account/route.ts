import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { isWithinBiliran } from "@/lib/biliran";
import { normalizeEmail, normalizePhone, PHONE_HINT } from "@/lib/validation";

async function me(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  return token ? await verifyToken(token) : null;
}

const SELECT = {
  username: true, role: true, email: true, contact: true, firstName: true, middleName: true, lastName: true, suffix: true,
  defaultAddress: true, defaultLat: true, defaultLng: true, emailUpdates: true, createdAt: true,
} as const;

/** The signed-in person's own details, including their home delivery location. */
export async function GET(req: NextRequest) {
  const payload = await me(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: payload.id }, select: SELECT });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

/**
 * Change your own details. Any of:
 *  - contact, email (customers sign in with their email, so it can't be blank)
 *  - emailUpdates (customers: payment and refund emails)
 *  - defaultAddress + defaultLat + defaultLng (customers: home drop-off point)
 * Names aren't changed here: they were checked when the account was approved.
 */
export async function PATCH(req: NextRequest) {
  const payload = await me(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const isCustomer = payload.role === "customer";

  if (body.contact !== undefined) {
    const raw = String(body.contact ?? "").trim();
    if (!raw && isCustomer) return NextResponse.json({ error: "Customers need a mobile number so the store and drivers can reach you.", field: "contact" }, { status: 400 });
    if (raw) {
      const c = normalizePhone(raw);
      if (!c) return NextResponse.json({ error: `Mobile number should be ${PHONE_HINT}.`, field: "contact" }, { status: 400 });
      if (isCustomer) {
        const taken = await prisma.user.findFirst({ where: { contact: c, role: "customer", accountStatus: { not: "rejected" }, NOT: { id: payload.id } } });
        if (taken) return NextResponse.json({ error: "That mobile number is already used by another account.", field: "contact" }, { status: 409 });
      }
      data.contact = c;
    } else data.contact = null;
  }

  if (body.email !== undefined) {
    const raw = String(body.email ?? "").trim();
    if (!raw && isCustomer) return NextResponse.json({ error: "You sign in with your email, so it can't be blank.", field: "email" }, { status: 400 });
    if (raw) {
      const e = normalizeEmail(raw);
      if (!e) return NextResponse.json({ error: "Enter a valid email address, e.g. juan.delacruz@gmail.com.", field: "email" }, { status: 400 });
      const taken = await prisma.user.findUnique({ where: { email: e } });
      if (taken && taken.id !== payload.id) return NextResponse.json({ error: "That email is already used by another account.", field: "email" }, { status: 409 });
      data.email = e;
    } else data.email = null;
  }

  if (body.emailUpdates !== undefined) data.emailUpdates = Boolean(body.emailUpdates);

  if (body.defaultLat !== undefined || body.defaultLng !== undefined || body.defaultAddress !== undefined) {
    if (!isCustomer) return NextResponse.json({ error: "Only customers have a home delivery location." }, { status: 400 });
    const lat = Number(body.defaultLat);
    const lng = Number(body.defaultLng);
    const address = String(body.defaultAddress ?? "").trim().slice(0, 300);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address) return NextResponse.json({ error: "Pin a location on the map." }, { status: 400 });
    if (!isWithinBiliran(lat, lng)) return NextResponse.json({ error: "The store delivers within Biliran province. Pin a location inside Biliran." }, { status: 400 });
    Object.assign(data, { defaultAddress: address, defaultLat: lat, defaultLng: lng });
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const user = await prisma.user.update({ where: { id: payload.id }, data, select: SELECT });
  return NextResponse.json(user);
}
