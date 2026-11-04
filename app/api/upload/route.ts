import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Images are stored in the database, not written to public/uploads. Hosted
// deployments (Vercel) have a read-only filesystem at runtime, so a file saved
// there either failed to write or was never served — which is why the GCash QR
// never showed for customers on the live site. The database works the same on
// Vercel and on a laptop install. Files are served by /api/uploads/[id].
export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (payload?.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });

  const data = Buffer.from(await file.arrayBuffer());
  const upload = await prisma.upload.create({
    data: { mimeType: file.type, data, size: data.length },
    select: { id: true },
  });

  return NextResponse.json({ url: `/api/uploads/${upload.id}` });
}
