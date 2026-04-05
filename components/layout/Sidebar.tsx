"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Receipt,
  ClipboardList, Store, ChevronLeft, ChevronRight, LogOut, Wrench, Tag, X
} from "lucide-react";
import { useState } from "react";

type NavItem = { label: string; href: string; icon: React.ReactNode };

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/admin", icon: <LayoutDashboard size={17} /> },
  { label: "Products", href: "/products", icon: <Package size={17} /> },
  { label: "Categories", href: "/categories", icon: <Tag size={17} /> },
  { label: "Users", href: "/users", icon: <Users size={17} /> },
  { label: "Transactions", href: "/transactions", icon: <Receipt size={17} /> },
  { label: "Orders", href: "/orders", icon: <ClipboardList size={17} /> },
];

const cashierNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/cashier", icon: <LayoutDashboard size={17} /> },
  { label: "POS", href: "/pos", icon: <ShoppingCart size={17} /> },
  { label: "Transactions", href: "/transactions", icon: <Receipt size={17} /> },
];

const customerNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/customer", icon: <LayoutDashboard size={17} /> },
  { label: "Shop", href: "/shop", icon: <Store size={17} /> },
  { label: "My Orders", href: "/orders", icon: <ClipboardList size={17} /> },
];

const navByRole: Record<string, NavItem[]> = { admin: adminNav, cashier: cashierNav, customer: customerNav };

export default function Sidebar({ role, mobileOpen, onClose }: { role: string; mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const nav = navByRole[role] ?? [];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const sidebarContent = (
    <aside className={`relative flex flex-col bg-white border-r border-gray-200 transition-all duration-300 h-full ${collapsed ? "w-16" : "w-56"} shrink-0`}>
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-[18px] border-b border-gray-100 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Wrench size={15} className="text-white" />
        </div>
        {!collapsed && <span className="font-bold text-sm text-gray-800 tracking-tight">HardwareStore</span>}
        {/* Close button — mobile only */}
        {!collapsed && (
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-gray-100 text-gray-400 lg:hidden">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[22px] w-6 h-6 bg-white border border-gray-200 rounded-full hidden lg:flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 z-10 shadow-sm"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* Role label */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-1">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{role}</span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${active ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"}
                ${collapsed ? "justify-center" : ""}
              `}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
