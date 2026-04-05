import DashboardLayout from "@/components/layout/DashboardLayout";

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout allowedRoles={["cashier"]}>{children}</DashboardLayout>;
}
