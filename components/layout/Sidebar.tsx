"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Receipt,
  ClipboardList, Store, LogOut, Tag, X, Truck, History, FileBarChart, PackagePlus, PanelLeftClose, PanelLeftOpen, Settings, Wallet
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLogout } from "@/hooks/useLogout";
import { STORE_NAME } from "@/lib/brand";
import { roleLabel } from "@/lib/roles";

type NavItem = { label: string; href: string; icon: React.ReactNode };
/** A labelled group of links, so each part of the system is easy to find. */
type NavGroup = { label: string; items: NavItem[] };

const dashboard = (href: string): NavItem => ({ label: "Dashboard", href, icon: <LayoutDashboard size={18} /> });
const products: NavItem = { label: "Products", href: "/products", icon: <Package size={18} /> };
const restocks: NavItem = { label: "Restocks", href: "/restocks", icon: <PackagePlus size={18} /> };
const categories: NavItem = { label: "Categories", href: "/categories", icon: <Tag size={18} /> };
const settings: NavGroup = { label: "Account", items: [{ label: "Settings", href: "/settings", icon: <Settings size={18} /> }] };

const adminNav: NavGroup[] = [
  { label: "Overview", items: [dashboard("/dashboard/admin")] },
  { label: "Inventory", items: [products, restocks, categories] },
  {
    label: "Sales",
    items: [
      { label: "Orders", href: "/orders", icon: <ClipboardList size={18} /> },
      { label: "Transactions", href: "/transactions", icon: <Receipt size={18} /> },
      { label: "Reports", href: "/reports", icon: <FileBarChart size={18} /> },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/users", icon: <Users size={18} /> },
      { label: "Settings", href: "/settings", icon: <Settings size={18} /> },
    ],
  },
];

const cashierNav: NavGroup[] = [
  { label: "Overview", items: [dashboard("/dashboard/cashier")] },
  {
    label: "Selling",
    items: [
      { label: "POS", href: "/pos", icon: <ShoppingCart size={18} /> },
      { label: "Orders", href: "/orders", icon: <ClipboardList size={18} /> },
      { label: "Transactions", href: "/transactions", icon: <Receipt size={18} /> },
    ],
  },
  { label: "Inventory", items: [products, restocks, categories] },
  { label: "Reporting", items: [{ label: "Reports", href: "/reports", icon: <FileBarChart size={18} /> }] },
  settings,
];

const customerNav: NavGroup[] = [
  { label: "Overview", items: [dashboard("/dashboard/customer")] },
  {
    label: "Shopping",
    items: [
      { label: "Shop", href: "/shop", icon: <Store size={18} /> },
      { label: "My Orders", href: "/orders", icon: <ClipboardList size={18} /> },
      { label: "Transactions", href: "/my-transactions", icon: <Wallet size={18} /> },
    ],
  },
  settings,
];

const driverNav: NavGroup[] = [
  { label: "Overview", items: [dashboard("/dashboard/driver")] },
  {
    label: "Deliveries",
    items: [
      { label: "My Deliveries", href: "/deliveries", icon: <Truck size={18} /> },
      { label: "History", href: "/deliveries/history", icon: <History size={18} /> },
    ],
  },
  settings,
];

const navByRole: Record<string, NavGroup[]> = { admin: adminNav, cashier: cashierNav, customer: customerNav, driver: driverNav };

type NavCounts = Record<string, { count: number; detail: string }>;

/** Work waiting behind a link (new orders, deliveries on hand), refreshed every 20 seconds. */
function useNavCounts(pathname: string): NavCounts {
  const [counts, setCounts] = useState<NavCounts>({});
  useEffect(() => {
    let live = true;
    const load = () => fetch("/api/nav-counts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d) setCounts(d); })
      .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    const onFocus = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => { live = false; clearInterval(t); document.removeEventListener("visibilitychange", onFocus); };
  // Re-count on navigation too, so confirming an order updates the badge right away.
  }, [pathname]);
  return counts;
}

// Its own component (not just a JSX fragment) because Sidebar renders two physical copies of the
// nav — desktop + mobile drawer — and each needs independent refs/measurements for its indicator.
function SidebarNav({ groups, pathname, collapsed, onNavigate, counts }: { groups: NavGroup[]; pathname: string; collapsed: boolean; onNavigate: () => void; counts: NavCounts }) {
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  const items = groups.flatMap((g) => g.items);
  // The most specific match wins, so /deliveries/history doesn't also light up /deliveries.
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

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
  }, [activeHref, collapsed, groups]);

  return (
    <nav className="relative flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
      {/* The active pill glides between links instead of jumping */}
      {indicator && (
        <div
          className="sidebar-indicator pointer-events-none absolute inset-x-3 top-0 rounded-xl bg-brand shadow-[0_10px_22px_-12px_rgba(30,79,216,0.9)]"
          style={{ transform: `translateY(${indicator.top}px)`, height: indicator.height }}
        />
      )}
      {groups.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? "mt-4" : ""}>
          {collapsed ? (
            gi > 0 && <div aria-hidden className="mx-2 mb-3 border-t border-line" />
          ) : (
            <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-4">{group.label}</p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              const badge = counts[item.href];
              const n = badge?.count ?? 0;
              const label = n > 0 ? `${item.label}: ${badge.detail}` : item.label;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => { if (el) itemRefs.current.set(item.href, el); }}
                  onClick={onNavigate}
                  title={collapsed || n > 0 ? label : undefined}
                  aria-label={n > 0 ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`relative z-10 flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors ${collapsed ? "justify-center" : ""} ${
                    active ? "text-white" : "text-ink-3 hover:bg-recess hover:text-ink"}`}
                >
                  <span className="relative shrink-0">
                    {item.icon}
                    {collapsed && n > 0 && (
                      <span aria-hidden className="absolute -right-2 -top-1.5 h-4 min-w-[16px] rounded-full bg-bad px-1 text-center text-[9.5px] font-bold leading-4 text-white ring-2 ring-surface">
                        {n > 99 ? "99+" : n}
                      </span>
                    )}
                  </span>
                  {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                  {!collapsed && n > 0 && (
                    <span aria-hidden className={`num ml-auto h-5 min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-bold leading-5 ${
                      active ? "bg-white/25 text-white" : "bg-bad text-white"}`}>
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar({ role, username, mobileOpen, onClose }: { role: string; username: string; mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(mobileOpen);
  const groups = navByRole[role] ?? [];
  const counts = useNavCounts(pathname);
  const { confirmOpen, requestLogout, cancelLogout, confirmLogout } = useLogout();

  useEffect(() => {
    if (mobileOpen) { setMobileVisible(true); return; }
    const t = setTimeout(() => setMobileVisible(false), 220);
    return () => clearTimeout(t);
  }, [mobileOpen]);

  const sidebarContent = (mobile: boolean) => {
    const slim = collapsed && !mobile;
    return (
      <aside
        className={`relative flex h-full shrink-0 flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_18px_40px_-24px_rgba(16,24,64,0.35)] transition-[width] duration-300 ${slim ? "w-[76px]" : "w-[248px]"}`}
      >
        {/* Brand */}
        <div className={`flex h-[68px] shrink-0 items-center gap-2.5 px-4 ${slim ? "justify-center px-2" : ""}`}>
          <Image src="/logo.png" alt={STORE_NAME} width={40} height={40} className="shrink-0 object-contain" priority />
          {!slim && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-display text-[15px] font-extrabold tracking-tight text-ink">{STORE_NAME}</p>
              <p className="truncate text-[11px] font-semibold text-brand">{roleLabel(role)} panel</p>
            </div>
          )}
          {mobile ? (
            <button type="button" onClick={onClose} aria-label="Close menu"
              className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-3 transition hover:bg-recess hover:text-ink">
              <X className="size-[18px]" />
            </button>
          ) : !slim && (
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-4 transition hover:bg-recess hover:text-ink">
              <PanelLeftClose className="size-[18px]" />
            </button>
          )}
        </div>
        {slim && (
          <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand"
            className="mx-auto mb-1 grid size-9 place-items-center rounded-xl text-ink-4 transition hover:bg-recess hover:text-ink">
            <PanelLeftOpen className="size-[18px]" />
          </button>
        )}

        <div aria-hidden className="mx-4 border-t border-line" />

        <SidebarNav groups={groups} pathname={pathname} collapsed={slim} onNavigate={onClose} counts={counts} />

        {/* Who is signed in, and the way out */}
        <div className="shrink-0 p-3">
          <div className={`flex items-center gap-2.5 rounded-2xl bg-subtle p-2 ${slim ? "flex-col" : ""}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-ink font-display text-sm font-extrabold text-white">
              {username.charAt(0).toUpperCase()}
            </span>
            {!slim && (
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13.5px] font-semibold text-ink">{username}</p>
                <p className="truncate text-[11.5px] text-ink-4">{roleLabel(role)}</p>
              </div>
            )}
            <button type="button" onClick={requestLogout} title="Log out"
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-ink-3 transition hover:bg-bad-soft hover:text-bad ${slim ? "w-full justify-center px-0" : ""}`}>
              <LogOut className="size-4" />{!slim && "Log out"}
            </button>
          </div>
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Desktop: a floating panel with breathing room on every side */}
      <div className="sticky top-0 hidden h-screen shrink-0 py-3 pl-3 lg:flex">
        {sidebarContent(false)}
      </div>

      {/* Mobile drawer */}
      {mobileVisible && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className={`absolute inset-0 bg-[rgba(10,14,36,0.5)] backdrop-blur-[3px] transition-opacity duration-200 ${mobileOpen ? "opacity-100 animate-overlay-in" : "opacity-0"}`}
            onClick={onClose}
          />
          <div className={`absolute inset-y-0 left-0 p-3 transition-transform duration-200 ${mobileOpen ? "translate-x-0 animate-sidebar-in" : "-translate-x-[110%]"}`}>
            {sidebarContent(true)}
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
        confirmLabel="Log out"
      />
    </>
  );
}
