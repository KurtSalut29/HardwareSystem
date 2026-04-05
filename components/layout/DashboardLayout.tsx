import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import DashboardLayoutClient from "@/components/layout/DashboardLayoutClient";

export default async function DashboardLayout({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  const payload = await verifyToken(token);
  if (!payload || !allowedRoles.includes(payload.role)) redirect("/login");

  return (
    <DashboardLayoutClient username={payload.username} role={payload.role}>
      {children}
    </DashboardLayoutClient>
  );
}
