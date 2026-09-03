"use client";

import { Bell, ChevronDown, Package, ShoppingBag, Settings, Sun, Moon, Monitor, Menu, LogOut, Clock, Truck } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import Badge from "@/components/ui/Badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLogout } from "@/hooks/useLogout";
import { useDriverAlerts } from "@/components/DriverAlertsProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { roleLabel } from "@/lib/roles";

type Notification = { id: string; type: "low_stock" | "new_order" | "delivery"; message: string };

function pageLabel(pathname: string, role: string): string {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/products")) return "Products";
  if (pathname.startsWith("/categories")) return "Categories";
  if (pathname.startsWith("/users")) return "Users";
  if (pathname.startsWith("/transactions")) return "Transactions";
  if (pathname.startsWith("/orders")) return role === "customer" ? "My Orders" : "Orders";
  if (pathname.startsWith("/pos")) return "Point of Sale";
  if (pathname.startsWith("/shop")) return "Shop";
  if (pathname.startsWith("/reports")) return role === "admin" ? "Sales Reports" : "Sales & Accomplishment Report";
  return "";
}

export default function Navbar({ username, role, onMenuClick }: { username: string; role: string; onMenuClick: () => void }) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { confirmOpen, requestLogout, cancelLogout, confirmLogout } = useLogout();
  const { alerts: deliveryAlerts, openPopup } = useDriverAlerts();

  useEffect(() => {
    if (role !== "admin") return;
    async function fetchNotifs() {
      const res = await fetch("/api/dashboard");
      if (!res.ok) return;
      const data = await res.json();
      const items: Notification[] = [];
      (data.lowStock ?? []).forEach((p: { id: number; name: string; stock: number }) => {
        items.push({ id: `ls-${p.id}`, type: "low_stock", message: `${p.name} is low on stock (${p.stock} left)` });
      });
      (data.recentOrders ?? []).filter((o: { status: string }) => o.status === "pending").forEach((o: { id: number }) => {
        items.push({ id: `ord-${o.id}`, type: "new_order", message: `Order #${o.id} is pending approval` });
      });
      setNotifs(items);
      setUnread(items.length);
    }
    fetchNotifs();
  }, [role]);

  // Live clock — set on mount only, so server/client markup matches (avoids hydration mismatch)
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const label = pageLabel(pathname, role);

  // Drivers get the same bell, fed by their live delivery assignments instead
  // of the admin's stock/order digest.
  const isDriver = role === "driver";
  const bellItems: Notification[] = isDriver
    ? deliveryAlerts.map((a) => ({
        id: `dlv-${a.key}`,
        type: "delivery",
        message: `Order #${a.id} — ${a.customer}${a.address ? ` · ${a.address}` : ""}`,
      }))
    : notifs;
  const bellUnread = isDriver ? deliveryAlerts.length : unread;
  const showBell = role === "admin" || isDriver;

  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-6 shrink-0 gap-3">
      {/* Hamburger — mobile only */}
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition shrink-0">
        <Menu size={ICON_SIZE.md} />
      </button>

      {/* Wayfinding — where am I? (desktop only, sidebar already carries this on mobile) */}
      <div className="hidden lg:flex flex-col justify-center min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: "var(--text-faint)" }}>{roleLabel(role)}</p>
        <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{label}</p>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">

        {/* Live clock */}
        {now && (
          <div className="hidden md:flex items-center gap-2 pr-3 mr-1 border-r border-gray-200">
            <Clock size={ICON_SIZE.sm} style={{ color: "var(--text-faint)" }} />
            <div className="leading-tight">
              <p className="text-xs font-bold num" style={{ color: "var(--text-secondary)" }}>
                {now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                {now.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        )}

        {/* Notifications — admin digest, or the driver's live assignments */}
        {showBell && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifs(!showNotifs); if (!isDriver) setUnread(0); }}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl transition"
              style={{ background: showNotifs ? "var(--bg-muted)" : "transparent", color: "var(--text-muted)" }}
            >
              <Bell size={ICON_SIZE.md} />
              {bellUnread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {bellUnread > 9 ? "9+" : bellUnread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div
                className="animate-panel-in origin-top-right fixed left-2 right-2 top-[60px] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-80 bg-white rounded-2xl shadow-xl border z-50 overflow-hidden"
                style={{ borderColor: "var(--border-strong)" }}
              >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {isDriver ? "My Deliveries" : "Notifications"}
                  </p>
                  {bellItems.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-muted)", color: "var(--text-muted)" }}>{bellItems.length} {isDriver ? "new" : "alerts"}</span>}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {bellItems.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell size={ICON_SIZE.lg} className="mx-auto mb-2" style={{ color: "var(--text-faint)" }} />
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                        {isDriver ? "No new deliveries assigned" : "You're all caught up"}
                      </p>
                    </div>
                  ) : bellItems.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={n.type === "low_stock" ? { background: "var(--warn-soft)", color: "var(--warn)" } : { background: "var(--brand-soft)", color: "var(--brand)" }}
                      >
                        {n.type === "low_stock" ? <Package size={ICON_SIZE.xs} /> : n.type === "delivery" ? <Truck size={ICON_SIZE.xs} /> : <ShoppingBag size={ICON_SIZE.xs} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: n.type === "low_stock" ? "var(--warn)" : "var(--brand)" }}>
                          {n.type === "low_stock" ? "Low stock" : n.type === "delivery" ? "New delivery" : "New order"}
                        </p>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {isDriver && bellItems.length > 0 && (
                  <button
                    onClick={() => { setShowNotifs(false); openPopup(); }}
                    className="w-full px-4 py-2.5 text-xs font-semibold border-t border-gray-100 transition hover:bg-gray-50"
                    style={{ color: "var(--brand)" }}
                  >
                    View delivery details
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition"
            style={{ background: showSettings ? "var(--bg-muted)" : "transparent", color: "var(--text-muted)" }}
          >
            <Settings size={ICON_SIZE.md} />
          </button>

          {showSettings && (
            <div
              className="animate-panel-in origin-top-right fixed left-2 right-2 top-[60px] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-60 bg-white rounded-2xl shadow-xl border z-50 overflow-hidden"
              style={{ borderColor: "var(--border-strong)" }}
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Settings</p>
              </div>

              {/* Appearance */}
              <div className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "var(--text-faint)" }}>Appearance</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggle("light")}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition"
                    style={theme === "light" ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    <Sun size={ICON_SIZE.sm} />
                    Light
                  </button>
                  <button
                    onClick={() => toggle("dark")}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition"
                    style={theme === "dark" ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    <Moon size={ICON_SIZE.sm} />
                    Dark
                  </button>
                  <button
                    onClick={() => {
                      const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                      toggle(sys);
                      localStorage.removeItem("theme");
                    }}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    <Monitor size={ICON_SIZE.sm} />
                    System
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 mx-1" style={{ background: "var(--border)" }} />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl transition"
            style={{ background: showProfile ? "var(--bg-muted)" : "transparent" }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-display font-extrabold shrink-0" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold leading-none" style={{ color: "var(--text-primary)" }}>{username}</p>
              <span className="mt-1 inline-block"><Badge label={roleLabel(role)} variant={role} /></span>
            </div>
            <ChevronDown size={ICON_SIZE.xs} style={{ color: "var(--text-faint)" }} />
          </button>

          {showProfile && (
            <div
              className="animate-panel-in origin-top-right fixed left-2 right-2 top-[60px] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-56 bg-white rounded-2xl shadow-xl border z-50 overflow-hidden"
              style={{ borderColor: "var(--border-strong)" }}
            >
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-display font-extrabold shrink-0" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>
                  {username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{username}</p>
                  <span className="mt-0.5 inline-block"><Badge label={roleLabel(role)} variant={role} /></span>
                </div>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => { setShowProfile(false); requestLogout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-[color:var(--bad-soft)]"
                  style={{ color: "var(--bad)" }}
                >
                  <LogOut size={ICON_SIZE.sm} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={cancelLogout}
        onConfirm={confirmLogout}
        title="Log out?"
        body="You'll need to sign in again to access your account."
        variant="warning"
        confirmLabel="Log Out"
      />
    </header>
  );
}
