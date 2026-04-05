import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload) redirect(`/dashboard/${payload.role}`);
  }
  redirect("/login");
}
