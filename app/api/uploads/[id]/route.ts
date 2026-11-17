import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// Serves an image saved by /api/upload or /api/payments/proof.
//  - Public images (product photos, the store's GCash QR) are open to everyone:
//    they appear on the storefront before anyone signs in, and never change, so
//    browsers may cache them forever.
//  - Private images (payment receipts) are shown only to staff and to the
//    person who uploaded them, and are never cached by shared caches.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uploadId = Number(id);
  if (!Number.isInteger(uploadId) || uploadId <= 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (upload.private) {
    const token = req.cookies.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const staff = payload && (payload.role === "admin" || payload.role === "cashier");
    // Customers may also open receipts attached to their own orders (e.g. the
    // store's screenshot of a refund it sent them).
    const own = !!payload && !staff && upload.ownerId !== payload.id
      ? await prisma.payment.findFirst({ where: { proofImage: `/api/uploads/${uploadId}`, order: { customerId: payload.id } }, select: { id: true } })
      : null;
    if (!payload || (!staff && upload.ownerId !== payload.id && !own)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return new NextResponse(new Uint8Array(upload.data), {
    headers: {
      "Content-Type": upload.mimeType,
      "Content-Length": String(upload.size),
      "Cache-Control": upload.private ? "private, max-age=3600" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
