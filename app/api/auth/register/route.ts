import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cleanName, fullName, nameProblem, normalizeEmail, normalizePhone, passwordProblem, PHONE_HINT, SUFFIXES } from "@/lib/validation";
import { isWithinBiliran } from "@/lib/biliran";
import { sendRegistrationReceived } from "@/lib/mailer";
import { getSettings } from "@/lib/settings";

/**
 * Customer self-registration. The account starts "pending": it can't sign in
 * until the admin approves it on the Users page, and the customer is emailed
 * when that happens. Staff and driver accounts are made by the admin instead.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const firstName = cleanName(body.firstName);
  const middleName = cleanName(body.middleName);
  const lastName = cleanName(body.lastName);
  const suffix = String(body.suffix ?? "").trim();
  const nameError =
    nameProblem(firstName, "first name", true) ??
    nameProblem(middleName, "middle name", false) ??
    nameProblem(lastName, "last name", true);
  if (nameError) return NextResponse.json({ error: nameError, field: "name" }, { status: 400 });
  if (suffix && !(SUFFIXES as readonly string[]).includes(suffix)) {
    return NextResponse.json({ error: "Choose a suffix from the list.", field: "name" }, { status: 400 });
  }

  const contact = normalizePhone(body.contact);
  if (!contact) return NextResponse.json({ error: `Enter a valid mobile number: ${PHONE_HINT}.`, field: "contact" }, { status: 400 });

  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address, e.g. juan.delacruz@gmail.com.", field: "contact" }, { status: 400 });

  const password = typeof body.password === "string" ? body.password : "";
  const pwError = passwordProblem(password);
  if (pwError) return NextResponse.json({ error: pwError, field: "password" }, { status: 400 });

  // The default drop-off point, pinned on the map.
  const lat = Number(body.defaultLat);
  const lng = Number(body.defaultLng);
  const address = String(body.defaultAddress ?? "").trim().slice(0, 300);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address) {
    return NextResponse.json({ error: "Pin your home or usual delivery location on the map.", field: "location" }, { status: 400 });
  }
  if (!isWithinBiliran(lat, lng)) {
    return NextResponse.json({ error: "The store delivers within Biliran province. Pin a location inside Biliran.", field: "location" }, { status: 400 });
  }

  // One account per email and per mobile number.
  const [emailTaken, contactTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findFirst({ where: { contact, role: "customer", accountStatus: { not: "rejected" } } }),
  ]);
  if (emailTaken) return NextResponse.json({ error: "That email is already registered. Sign in instead, or use another email.", field: "contact" }, { status: 409 });
  if (contactTaken) return NextResponse.json({ error: "That mobile number is already registered to another account.", field: "contact" }, { status: 409 });

  // The username is the display name the rest of the system shows ("Juan P. Dela Cruz"),
  // numbered if two customers share a name.
  const display = fullName({ firstName, middleName, lastName, suffix });
  let username = display;
  for (let n = 2; await prisma.user.findUnique({ where: { username } }); n++) username = `${display} (${n})`;

  const hashed = await bcrypt.hash(password, 10);
  // The admin decides in Settings whether new customers wait for approval.
  const { requireCustomerApproval } = await getSettings();
  await prisma.user.create({
    data: {
      username,
      password: hashed,
      // Public signup only ever creates customers; a `role` sent by a client is ignored.
      role: "customer",
      contact,
      email,
      firstName,
      middleName: middleName || null,
      lastName,
      suffix: suffix || null,
      accountStatus: requireCustomerApproval ? "pending" : "approved",
      defaultAddress: address,
      defaultLat: lat,
      defaultLng: lng,
    },
  });

  if (!requireCustomerApproval) {
    return NextResponse.json({ message: "Account created", email, emailSent: false, approved: true }, { status: 201 });
  }
  const mail = await sendRegistrationReceived(email, firstName);
  return NextResponse.json({ message: "Registration received", email, emailSent: mail.sent, approved: false }, { status: 201 });
}
