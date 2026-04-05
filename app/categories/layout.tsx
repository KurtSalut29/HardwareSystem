import DashboardLayout from "@/components/layout/DashboardLayout";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout allowedRoles={["admin"]}>{children}</DashboardLayout>;
}
