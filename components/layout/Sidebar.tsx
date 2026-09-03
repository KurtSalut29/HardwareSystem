"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Receipt,
  ClipboardList, Store, ChevronLeft, ChevronRight, LogOut, Tag, X, Truck, History, FileBarChart
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLogout } from "@/hooks/useLogout";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { STORE_NAME } from "@/lib/brand";
import { roleLabel } from "@/lib/roles";

type NavItem = { label: string; href: string; icon: React.ReactNode };

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/admin", icon: <LayoutDashboard size={ICON_SIZE.md} /> },
  { label: "Products", href: "/products", icon: <Package size={ICON_SIZE.md} /> },
  { label: "Categories", href: "/categories", icon: <Tag size={ICON_SIZE.md} /> },
  { label: "Users", href: "/users", icon: <Users size={ICON_SIZE.md} /> },
  { label: "Transactions", href: "/transactions", icon: <Receipt size={ICON_SIZE.md} /> },
  { label: "Orders", href: "/orders", icon: <ClipboardList size={ICON_SIZE.md} /> },
  { label: "Reports", href: "/reports", icon: <FileBarChart size={ICON_SIZE.md} /> },
];

const cashierNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/cashier", icon: <LayoutDashboard size={ICON_SIZE.md} /> },
  { label: "POS", href: "/pos", icon: <ShoppingCart size={ICON_SIZE.md} /> },
  { label: "Orders", href: "/orders", icon: <ClipboardList size={ICON_SIZE.md} /> },
  { label: "Transactions", href: "/transactions", icon: <Receipt size={ICON_SIZE.md} /> },
  { label: "Reports", href: "/reports", icon: <FileBarChart size={ICON_SIZE.md} /> },
];

const customerNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/customer", icon: <LayoutDashboard size={ICON_SIZE.md} /> },
  { label: "Shop", href: "/shop", icon: <Store size={ICON_SIZE.md} /> },
  { label: "My Orders", href: "/orders", icon: <ClipboardList size={ICON_SIZE.md} /> },
];

const driverNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/driver", icon: <LayoutDashboard size={ICON_SIZE.md} /> },
  { label: "My Deliveries", href: "/deliveries", icon: <Truck size={ICON_SIZE.md} /> },
  { label: "History", href: "/deliveries/history", icon: <History size={ICON_SIZE.md} /> },
];

const navByRole: Record<string, NavItem[]> = { admin: adminNav, cashier: cashierNav, customer: customerNav, driver: driverNav };

// Its own component (not just a JSX fragment) because Sidebar renders two physical copies of the
// nav — desktop + mobile drawer — and each needs independent refs/measurements for its indicator.
function SidebarNav({ nav, pathname, collapsed, onNavigate }: { nav: NavItem[]; pathname: string; collapsed: boolean; onNavigate: () => void }) {
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  const activeHref = nav.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.href;

  useLayoutEffect(() => {
    function measure() {
      if (!activeHref) { setIndicator(null); return; }
      const el = itemRefs.current.get(activeHref);
      if (el) setIndicator({ top: el.offsetTop, height: el.offsetHeight });
    }
    measure();
    // Re-measure on resize too, so a collapsed<->expanded viewport change doesn't leave
    // the indicator stuck at a stale position measured while the pane was display:none.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeHref, collapsed, nav]);

  return (
    <nav className="relative flex-1 px-2 py-2 space-y-0.5">
      {indicator && (
        <div
          className="sidebar-indicator absolute inset-x-0 top-0 rounded-lg pointer-events-none"
          style={{ transform: `translateY(${indicator.top}px)`, height: indicator.height, background: "var(--nav-active)" }}
        />
      )}
      {nav.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(el) => { if (el) itemRefs.current.set(item.href, el); }}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            style={{ color: active ? "var(--nav-active-ink)" : "var(--nav-ink-dim)" }}
            className={`relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border border-transparent hover:text-[color:var(--text-primary)]
              ${collapsed ? "justify-center" : ""} ${!active ? "hover:bg-[color:var(--bg-muted)]" : ""}
            `}
          >
            <span className="shrink-0" style={active ? { color: "var(--accent)" } : undefined}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ role, mobileOpen, onClose }: { role: string; mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(mobileOpen);
  const nav = navByRole[role] ?? [];
  const { confirmOpen, requestLogout, cancelLogout, confirmLogout } = useLogout();

  useEffect(() => {
    if (mobileOpen) { setMobileVisible(true); return; }
    const t = setTimeout(() => setMobileVisible(false), 220);
    return () => clearTimeout(t);
  }, [mobileOpen]);

  const sidebarContent = (
    <aside
      style={{ background: "var(--nav-bg)", borderColor: "var(--nav-line)" }}
      className={`relative flex flex-col border-r transition-all duration-300 h-full ${collapsed ? "w-16" : "w-56"} shrink-0`}
    >
      {/* Logo */}
      <div style={{ borderColor: "var(--nav-line)" }} className={`flex items-center gap-2.5 px-4 py-2 border-b ${collapsed ? "justify-center" : ""}`}>
        <Image src="/logo.png" alt={STORE_NAME} width={48} height={48} className="shrink-0 object-contain" priority />
        {!collapsed && <span className="font-display font-extrabold text-sm tracking-tight" style={{ color: "var(--nav-ink)" }}>{STORE_NAME}</span>}
        {/* Close button — mobile only */}
        {!collapsed && (
          <button onClick={onClose} className="ml-auto p-1 rounded-lg transition lg:hidden" style={{ color: "var(--nav-ink-dim)" }}>
            <X size={ICON_SIZE.md} />
          </button>
        )}
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{ background: "var(--bg-card)", borderColor: "var(--nav-line)", color: "var(--nav-ink-dim)" }}
        className="absolute -right-3 top-[22px] w-6 h-6 border rounded-full hidden lg:flex items-center justify-center hover:text-[color:var(--brand)] transition z-10 shadow-sm"
      >
        {collapsed ? <ChevronRight size={ICON_SIZE.xs} /> : <ChevronLeft size={ICON_SIZE.xs} />}
      </button>

      {/* Role label */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-1">
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--nav-ink-dim)" }}>{roleLabel(role)}</span>
        </div>
      )}

      <SidebarNav nav={nav} pathname={pathname} collapsed={collapsed} onNavigate={onClose} />

      {/* Logout */}
      <div className="px-2 py-4 border-t" style={{ borderColor: "var(--nav-line)" }}>
        <button
          onClick={requestLogout}
          title={collapsed ? "Logout" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[color:var(--bad-soft)] hover:!text-[color:var(--bad)] transition-all ${collapsed ? "justify-center" : ""}`}
          style={{ color: "var(--nav-ink-dim)" }}
        >
          <LogOut size={ICON_SIZE.md} className="shrink-0" />
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
      {mobileVisible && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Overlay */}
          <div
            className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${mobileOpen ? "opacity-100 animate-overlay-in" : "opacity-0"}`}
            onClick={onClose}
          />
          {/* Drawer */}
          <div className={`absolute left-0 top-0 h-full transition-transform duration-200 ${mobileOpen ? "translate-x-0 animate-sidebar-in" : "-translate-x-full"}`}>
            {sidebarContent}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={cancelLogout}
        onConfirm={confirmLogout}
        title="Log out?"
        body="You'll need to sign in again to access your account."
        variant="warning"
        confirmLabel="Log Out"
      />
    </>
  );
}
