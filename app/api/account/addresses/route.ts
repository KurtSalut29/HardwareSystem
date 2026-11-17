import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { isWithinBiliran } from "@/lib/biliran";
import { normalizePhone, PHONE_HINT } from "@/lib/validation";

const MAX_ADDRESSES = 10;

async function customer(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  return payload?.role === "customer" ? payload : null;
}

/** Checks an address from the form. Returns the fields to save, or an error. */
function parse(body: Record<string, unknown>) {
  const label = String(body.label ?? "").trim().slice(0, 40);
  const address = String(body.address ?? "").trim().slice(0, 300);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const notes = String(body.notes ?? "").trim().slice(0, 200) || null;
  const recipientName = String(body.recipientName ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || null;
  const rawContact = String(body.recipientContact ?? "").trim();
  if (!label) return { error: "Give this address a name, e.g. Work or Nanay's house." };
  if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return { error: "Pin the location on the map." };
  if (!isWithinBiliran(latitude, longitude)) return { error: "The store delivers within Biliran province. Pin a location inside Biliran." };
  let recipientContact: string | null = null;
  if (rawContact) {
    recipientContact = normalizePhone(rawContact);
    if (!recipientContact) return { error: `Receiver's number should be ${PHONE_HINT}.` };
  }
  if (recipientContact && !recipientName) return { error: "Add the receiver's name with their number." };
  return { data: { label, address, latitude, longitude, notes, recipientName, recipientContact } };
}

export async function GET(req: NextRequest) {
  const user = await customer(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.savedAddress.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await customer(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const count = await prisma.savedAddress.count({ where: { userId: user.id } });
  if (count >= MAX_ADDRESSES) return NextResponse.json({ error: `You can save up to ${MAX_ADDRESSES} addresses. Delete one you no longer use first.` }, { status: 400 });
  const parsed = parse(await req.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const row = await prisma.savedAddress.create({ data: { ...parsed.data, userId: user.id } });
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await customer(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const existing = await prisma.savedAddress.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "That address wasn't found." }, { status: 404 });
  const parsed = parse(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const row = await prisma.savedAddress.update({ where: { id }, data: parsed.data });
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest) {
  const user = await customer(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  const res = await prisma.savedAddress.deleteMany({ where: { id, userId: user.id } });
  if (res.count === 0) return NextResponse.json({ error: "That address wasn't found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
