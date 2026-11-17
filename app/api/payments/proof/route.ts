import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Uploads a payment screenshot (a customer's GCash receipt, or the store's
 * refund receipt). Stored privately: only staff and the uploader can open it.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Sign in again to upload." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose the screenshot of your GCash receipt." }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "The receipt must be a photo or screenshot (JPG, PNG or WebP)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large (3 MB at most). Take a screenshot instead of a photo." }, { status: 400 });

  const data = Buffer.from(await file.arrayBuffer());
  const upload = await prisma.upload.create({
    data: { mimeType: file.type, data, size: data.length, private: true, ownerId: payload.id },
    select: { id: true },
  });
  return NextResponse.json({ url: `/api/uploads/${upload.id}` });
}
