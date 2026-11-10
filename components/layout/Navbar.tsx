"use client";

import { Bell, ChevronDown, Package, ShoppingBag, Settings, Sun, Moon, Monitor, Menu, LogOut, Clock, Truck, PackageX, ClipboardCheck, Volume2, VolumeX } from "lucide-react";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import Badge from "@/components/ui/Badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLogout } from "@/hooks/useLogout";
import { useDriverAlerts } from "@/components/DriverAlertsProvider";
import { useNotifications } from "@/components/NotificationsProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { roleLabel } from "@/lib/roles";
import { isSoundOn, playAlert, setSoundOn, subscribeSound, unlockAudio, type AlertSound } from "@/lib/sounds";

type BellType = "new_order" | "low_stock" | "out_of_stock" | "order_update" | "delivery";
type BellItem = { id: string; type: BellType; title: string; message: string; href?: string; unread: boolean };

// Icon, colors and label for each kind of notification in the bell.
const BELL_STYLE: Record<BellType, { icon: typeof Bell; fg: string; bg: string }> = {
  new_order: { icon: ShoppingBag, fg: "var(--brand)", bg: "var(--brand-soft)" },
  order_update: { icon: ClipboardCheck, fg: "var(--good)", bg: "var(--good-soft)" },
  delivery: { icon: Truck, fg: "var(--brand)", bg: "var(--brand-soft)" },
  low_stock: { icon: Package, fg: "var(--warn)", bg: "var(--warn-soft)" },
  out_of_stock: { icon: PackageX, fg: "var(--bad)", bg: "var(--bad-soft)" },
};

// The sound each role hears most, played by the "Test" button in Settings.
const TEST_SOUND: Record<string, AlertSound> = {
  admin: "new_order",
  cashier: "new_order",
  customer: "order_update",
  driver: "delivery",
};

function pageLabel(pathname: string, role: string): string {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/products")) return "Products";
  if (pathname.startsWith("/restocks")) return "Restocks";
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
  const [now, setNow] = useState<Date | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { confirmOpen, requestLogout, cancelLogout, confirmLogout } = useLogout();
  const { alerts: deliveryAlerts, openPopup } = useDriverAlerts();
  const { items: feed, unread: feedUnread, isUnread, markAllRead } = useNotifications();
  const soundOn = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  const [newWhenOpened, setNewWhenOpened] = useState<Set<string>>(new Set());

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

  // Every role has a bell. Drivers' is fed by their live delivery assignments;
  // everyone else's by the notification feed (orders, stock, order progress).
  const isDriver = role === "driver";
  const bellItems: BellItem[] = isDriver
    ? deliveryAlerts.map((a) => ({
        id: `dlv-${a.key}`,
        type: "delivery",
        title: "New delivery",
        message: `Order #${a.id} — ${a.customer}${a.address ? ` · ${a.address}` : ""}`,
        unread: true,
      }))
    : feed.map((n) => ({ id: n.key, type: n.type, title: n.title, message: n.message, href: n.href, unread: newWhenOpened.has(n.key) || isUnread(n.key) }));
  const bellUnread = isDriver ? deliveryAlerts.length : feedUnread;
  const emptyText = isDriver ? "No new deliveries assigned" : role === "customer" ? "No order updates yet" : "You're all caught up";

  // Opening the bell clears the count, but what was new keeps its dot while the
  // panel is open, so people can still see which ones they hadn't read.
  function toggleBell() {
    const opening = !showNotifs;
    setShowNotifs(opening);
    if (opening && !isDriver) {
      setNewWhenOpened(new Set(feed.filter((n) => isUnread(n.key)).map((n) => n.key)));
      markAllRead();
    }
  }

  function openItem(item: BellItem) {
    setShowNotifs(false);
    if (item.href) router.push(item.href);
  }

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

        {/* Notifications: the role's feed, or the driver's live assignments */}
        {
          <div className="relative" ref={notifRef}>
            <button
              onClick={toggleBell}
              aria-label={bellUnread > 0 ? `Notifications, ${bellUnread} unread` : "Notifications"}
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
                  {bellItems.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-muted)", color: "var(--text-muted)" }}>{bellItems.length} {isDriver ? "new" : bellItems.length === 1 ? "alert" : "alerts"}</span>}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {bellItems.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell size={ICON_SIZE.lg} className="mx-auto mb-2" style={{ color: "var(--text-faint)" }} />
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{emptyText}</p>
                    </div>
                  ) : bellItems.map((n) => {
                    const style = BELL_STYLE[n.type];
                    const Icon = style.icon;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openItem(n)}
                        disabled={!n.href}
                        className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 disabled:cursor-default"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: style.bg, color: style.fg }}>
                          <Icon size={ICON_SIZE.xs} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: style.fg }}>
                            {n.title}
                            {n.unread && !isDriver && <span aria-label="unread" className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand)" }} />}
                          </p>
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
                        </div>
                      </button>
                    );
                  })}
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
        }

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

              {/* Notification sound */}
              <div className="px-4 py-3 border-t border-gray-100">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "var(--text-faint)" }}>Notification sound</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundOn}
                    onClick={() => { unlockAudio(); setSoundOn(!soundOn); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition"
                    style={soundOn ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    {soundOn ? <Volume2 size={ICON_SIZE.sm} /> : <VolumeX size={ICON_SIZE.sm} />}
                    {soundOn ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { unlockAudio(); playAlert(TEST_SOUND[role] ?? "new_order", { force: true }); }}
                    className="flex-1 py-2 rounded-xl border text-xs font-semibold transition hover:bg-gray-50"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    Test
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
