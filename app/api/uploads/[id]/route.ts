import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Serves an image saved by /api/upload. Public on purpose: product photos appear
// on the storefront before anyone signs in, and the GCash QR is shown to customers.
// An upload is never changed after it is created, so browsers may cache it forever.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uploadId = Number(id);
  if (!Number.isInteger(uploadId) || uploadId <= 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(upload.data), {
    headers: {
      "Content-Type": upload.mimeType,
      "Content-Length": String(upload.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
