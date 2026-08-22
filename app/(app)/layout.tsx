import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import DashboardLayoutClient from "@/components/layout/DashboardLayoutClient";

// Shared by every authenticated route (dashboard/*, products, categories, users, transactions,
// orders, pos, shop) so the Sidebar/Navbar mount once and persist across navigation instead of
// remounting per page — that's what makes the sidebar's active-item indicator able to animate.
//
// Role-based access per route is enforced centrally in middleware.ts (ROLE_ROUTES) before a
// request ever reaches here, so this layout only needs to confirm a valid session exists and
// read who's logged in to pass down to the shell.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  const payload = await verifyToken(token);
  if (!payload) redirect("/login");

  return (
    <DashboardLayoutClient username={payload.username} role={payload.role}>
      {children}
    </DashboardLayoutClient>
  );
}
