"use client";

import {
  Bell, ChevronDown, Package, ShoppingBag, Settings, Sun, Moon, Monitor, Menu, LogOut, Truck, PackageX, ClipboardCheck,
  Volume2, VolumeX, UserPlus, LayoutDashboard, PackagePlus, Tag, Users, Receipt, ClipboardList, ShoppingCart, Store,
  FileBarChart, History, BellRing, CheckCheck,
} from "lucide-react";
import { createElement, useState, useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLogout } from "@/hooks/useLogout";
import { useDriverAlerts } from "@/components/DriverAlertsProvider";
import { useNotifications } from "@/components/NotificationsProvider";
import { roleLabel } from "@/lib/roles";
import { isSoundOn, playAlert, setSoundOn, subscribeSound, unlockAudio, type AlertSound } from "@/lib/sounds";
import { desktopPermission, requestDesktop } from "@/lib/desktopNotify";

type BellType = "new_order" | "new_customer" | "low_stock" | "out_of_stock" | "order_update" | "delivery";
type BellItem = { id: string; type: BellType; title: string; message: string; href?: string; unread: boolean };

// Icon and colours for each kind of notification in the bell.
const BELL_STYLE: Record<BellType, { icon: typeof Bell; chip: string; text: string }> = {
  new_order: { icon: ShoppingBag, chip: "bg-brand-soft text-brand", text: "text-brand" },
  new_customer: { icon: UserPlus, chip: "bg-brand-soft text-brand", text: "text-brand" },
  order_update: { icon: ClipboardCheck, chip: "bg-good-soft text-good", text: "text-good" },
  delivery: { icon: Truck, chip: "bg-brand-soft text-brand", text: "text-brand" },
  low_stock: { icon: Package, chip: "bg-warn-soft text-warn", text: "text-warn" },
  out_of_stock: { icon: PackageX, chip: "bg-bad-soft text-bad", text: "text-bad" },
};

// The sound each role hears most, played by the "Test" button in Settings.
const TEST_SOUND: Record<string, AlertSound> = {
  admin: "new_order",
  cashier: "new_order",
  customer: "order_update",
  driver: "delivery",
};

/** Where the user is: the page name, the area of the store it belongs to, and its icon. */
function pageInfo(pathname: string, role: string): { label: string; area: string; icon: typeof Bell } {
  if (pathname.startsWith("/dashboard")) return { label: "Dashboard", area: "Overview", icon: LayoutDashboard };
  if (pathname.startsWith("/products")) return { label: "Products", area: "Inventory", icon: Package };
  if (pathname.startsWith("/restocks")) return { label: "Restocks", area: "Inventory", icon: PackagePlus };
  if (pathname.startsWith("/categories")) return { label: "Categories", area: "Inventory", icon: Tag };
  if (pathname.startsWith("/users")) return { label: "Users", area: "Administration", icon: Users };
  if (pathname.startsWith("/transactions")) return { label: "Transactions", area: "Sales", icon: Receipt };
  if (pathname.startsWith("/orders")) return role === "customer"
    ? { label: "My orders", area: "Shopping", icon: ClipboardList }
    : { label: "Orders", area: "Sales", icon: ClipboardList };
  if (pathname.startsWith("/pos")) return { label: "Point of sale", area: "Selling", icon: ShoppingCart };
  if (pathname.startsWith("/shop")) return { label: "Shop", area: "Shopping", icon: Store };
  if (pathname.startsWith("/reports")) return { label: role === "admin" ? "Sales reports" : "Sales report", area: "Reporting", icon: FileBarChart };
  if (pathname.startsWith("/deliveries/history")) return { label: "Delivery history", area: "Deliveries", icon: History };
  if (pathname.startsWith("/deliveries")) return { label: "My deliveries", area: "Deliveries", icon: Truck };
  return { label: "", area: "", icon: LayoutDashboard };
}

// Every dropdown from the bar shares one look: a floating card under its button,
// full width under the bar on phones.
const PANEL = "animate-pop-in fixed inset-x-3 top-[84px] z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(10,14,36,0.45)] md:absolute md:inset-x-auto md:right-0 md:top-[calc(100%+10px)]";
const ICON_BTN = "relative grid size-10 place-items-center rounded-xl text-ink-3 transition hover:bg-recess hover:text-ink";
const SECTION_LABEL = "mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-4";

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
  // Bumped after the browser's permission prompt so the settings row re-reads it.
  const [, setDesktopAsked] = useState(0);

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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setShowNotifs(false); setShowProfile(false); setShowSettings(false); }
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", onKey); };
  }, []);

  const page = pageInfo(pathname, role);

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
    setShowSettings(false); setShowProfile(false);
    if (opening && !isDriver) {
      setNewWhenOpened(new Set(feed.filter((n) => isUnread(n.key)).map((n) => n.key)));
      markAllRead();
    }
  }

  function openItem(item: BellItem) {
    setShowNotifs(false);
    if (item.href) router.push(item.href);
  }

  function applySystemTheme() {
    const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    toggle(sys);
    localStorage.removeItem("theme");
  }

  const initial = username.charAt(0).toUpperCase();

  return (
    <header className="relative z-40 shrink-0 px-3 pt-3 md:px-6">
      <div className="flex h-16 items-center gap-2 rounded-[20px] border border-line bg-surface/90 px-2.5 shadow-[0_12px_30px_-22px_rgba(16,24,64,0.4)] backdrop-blur md:gap-3 md:px-3">
        {/* Menu — phones and tablets */}
        <button type="button" onClick={onMenuClick} aria-label="Open menu" className={`${ICON_BTN} border border-line lg:hidden`}>
          <Menu className="size-5" />
        </button>

        {/* Where am I */}
        {page.label && (
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand sm:grid">
              {createElement(page.icon, { className: "size-5" })}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[11px] font-semibold text-ink-4">
                {roleLabel(role)} <span className="text-line-strong">/</span> {page.area}
              </p>
              <p className="truncate font-display text-[16px] font-extrabold tracking-tight text-ink">{page.label}</p>
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1 md:gap-1.5">
          {/* Live clock */}
          {now && (
            <div className="mr-1 hidden h-10 items-center gap-2.5 rounded-xl bg-subtle px-3 md:flex">
              <span className="relative flex size-2">
                <span className="animate-live-ping absolute inline-flex size-full rounded-full bg-good" />
                <span className="relative inline-flex size-2 rounded-full bg-good" />
              </span>
              <div className="leading-tight">
                <p className="num text-[13px] font-bold text-ink">{now.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</p>
                <p className="text-[10.5px] font-medium text-ink-4">{now.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}</p>
              </div>
            </div>
          )}

          {/* Quick light/dark switch */}
          <button type="button" onClick={() => toggle(theme === "dark" ? "light" : "dark")} className={`${ICON_BTN} hidden sm:grid`}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>

          {/* Notifications: the role's feed, or the driver's live assignments */}
          <div className="relative" ref={notifRef}>
            <button type="button" onClick={toggleBell} aria-expanded={showNotifs}
              aria-label={bellUnread > 0 ? `Notifications, ${bellUnread} unread` : "Notifications"}
              className={`${ICON_BTN} ${showNotifs ? "bg-recess text-ink" : ""}`}>
              {bellUnread > 0 ? <BellRing className="size-[18px]" /> : <Bell className="size-[18px]" />}
              {bellUnread > 0 && (
                <span className="num absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                  {bellUnread > 9 ? "9+" : bellUnread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className={`${PANEL} md:w-[360px]`}>
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
                  <div>
                    <p className="font-display text-[15px] font-extrabold text-ink">{isDriver ? "My deliveries" : "Notifications"}</p>
                    <p className="text-[12px] text-ink-4">{bellItems.length ? `${bellItems.length} ${isDriver ? "new" : bellItems.length === 1 ? "alert" : "alerts"}` : "Nothing new"}</p>
                  </div>
                  {!isDriver && bellItems.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">
                      <CheckCheck className="size-3" /> All read
                    </span>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto p-1.5">
                  {bellItems.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <span className="mx-auto mb-2 grid size-11 place-items-center rounded-2xl bg-recess text-ink-4"><Bell className="size-5" /></span>
                      <p className="text-sm font-semibold text-ink-2">{emptyText}</p>
                      <p className="mt-0.5 text-[12px] text-ink-4">New alerts show up here with a sound.</p>
                    </div>
                  ) : bellItems.map((n) => {
                    const st = BELL_STYLE[n.type];
                    return (
                      <button key={n.id} type="button" onClick={() => openItem(n)} disabled={!n.href}
                        className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-subtle disabled:cursor-default disabled:hover:bg-transparent">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${st.chip}`}>{createElement(st.icon, { className: "size-4" })}</span>
                        <span className="min-w-0 flex-1">
                          <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${st.text}`}>
                            {n.title}
                            {n.unread && !isDriver && <span aria-label="unread" className="size-1.5 rounded-full bg-brand" />}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{n.message}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {isDriver && bellItems.length > 0 && (
                  <div className="border-t border-line p-2">
                    <button type="button" onClick={() => { setShowNotifs(false); openPopup(); }}
                      className="h-9 w-full rounded-xl bg-brand-soft text-[13px] font-semibold text-brand-ink transition hover:bg-brand-soft/70">
                      View delivery details
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button type="button" onClick={() => { setShowSettings(!showSettings); setShowNotifs(false); setShowProfile(false); }}
              aria-label="Settings" aria-expanded={showSettings} className={`${ICON_BTN} ${showSettings ? "bg-recess text-ink" : ""}`}>
              <Settings className="size-[18px]" />
            </button>

            {showSettings && (
              <div className={`${PANEL} md:w-[300px]`}>
                <div className="border-b border-line px-4 py-3.5">
                  <p className="font-display text-[15px] font-extrabold text-ink">Settings</p>
                  <p className="text-[12px] text-ink-4">Saved on this device</p>
                </div>

                {/* Appearance */}
                <div className="px-4 py-3.5">
                  <p className={SECTION_LABEL}>Appearance</p>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-recess p-1">
                    {([
                      { key: "light", label: "Light", icon: Sun, on: theme === "light", act: () => toggle("light") },
                      { key: "dark", label: "Dark", icon: Moon, on: theme === "dark", act: () => toggle("dark") },
                      { key: "system", label: "System", icon: Monitor, on: false, act: applySystemTheme },
                    ]).map((o) => (
                      <button key={o.key} type="button" onClick={o.act} aria-pressed={o.on}
                        className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[12px] font-semibold transition ${
                          o.on ? "bg-surface text-brand-ink shadow-[0_1px_3px_rgba(16,24,64,0.12)]" : "text-ink-3 hover:text-ink"}`}>
                        {createElement(o.icon, { className: "size-4" })}{o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification sound */}
                <div className="border-t border-line px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${soundOn ? "bg-brand-soft text-brand" : "bg-recess text-ink-4"}`}>
                      {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink">Alert sound</p>
                      <p className="text-[12px] text-ink-4">{soundOn ? "Plays for new alerts" : "Muted"}</p>
                    </div>
                    <button type="button" role="switch" aria-checked={soundOn} aria-label="Alert sound"
                      onClick={() => { unlockAudio(); setSoundOn(!soundOn); }}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${soundOn ? "bg-brand" : "bg-line-strong"}`}>
                      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${soundOn ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </div>
                  <button type="button" onClick={() => { unlockAudio(); playAlert(TEST_SOUND[role] ?? "new_order", { force: true }); }}
                    className="mt-2.5 h-8 w-full rounded-lg border border-line text-[12.5px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink">
                    Play a test sound
                  </button>
                </div>

                {/* Desktop alerts: pop up even when this tab is in the background */}
                {role !== "driver" && (() => {
                  const perm = desktopPermission();
                  return (
                    <div className="border-t border-line px-4 py-3.5">
                      <p className={SECTION_LABEL}>Desktop alerts</p>
                      <p className="mb-2 text-[12px] text-ink-3">Pop up from the taskbar when you&apos;re on another tab or app.</p>
                      {perm === "granted" ? (
                        <p className="inline-flex items-center gap-1.5 rounded-lg bg-good-soft px-2.5 py-1 text-[12px] font-semibold text-good"><CheckCheck className="size-3.5" /> On for this browser</p>
                      ) : perm === "denied" ? (
                        <p className="rounded-lg bg-warn-soft px-2.5 py-2 text-[12px] text-warn">Blocked. Allow notifications for this site from the lock icon in the address bar.</p>
                      ) : perm === "unsupported" ? (
                        <p className="text-[12px] text-ink-4">This browser doesn&apos;t support them.</p>
                      ) : (
                        <button type="button" onClick={async () => { unlockAudio(); await requestDesktop(); setDesktopAsked((n) => n + 1); }}
                          className="h-9 w-full rounded-lg bg-brand text-[13px] font-semibold text-white transition hover:brightness-110">
                          Turn on desktop alerts
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <span aria-hidden className="mx-1 hidden h-7 w-px bg-line sm:block" />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button type="button" onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); setShowSettings(false); }}
              aria-expanded={showProfile} aria-label="Account menu"
              className={`flex h-11 items-center gap-2.5 rounded-xl pl-1 pr-1.5 transition hover:bg-recess sm:pr-2.5 ${showProfile ? "bg-recess" : ""}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-ink font-display text-sm font-extrabold text-white">{initial}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-[140px] truncate text-[13.5px] font-semibold text-ink">{username}</span>
                <span className="block text-[11.5px] text-ink-4">{roleLabel(role)}</span>
              </span>
              <ChevronDown className={`hidden size-4 text-ink-4 transition sm:block ${showProfile ? "rotate-180" : ""}`} />
            </button>

            {showProfile && (
              <div className={`${PANEL} md:w-[260px]`}>
                <div className="flex items-center gap-3 bg-subtle px-4 py-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-ink font-display text-base font-extrabold text-white">{initial}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-ink">{username}</p>
                    <span className="mt-0.5 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">{roleLabel(role)}</span>
                  </div>
                </div>
                <div className="space-y-0.5 border-t border-line p-1.5">
                  <button type="button" onClick={() => { setShowProfile(false); setShowSettings(true); }}
                    className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-semibold text-ink-2 transition hover:bg-recess hover:text-ink">
                    <Settings className="size-4" /> Settings
                  </button>
                  <button type="button" onClick={() => { setShowProfile(false); requestLogout(); }}
                    className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-semibold text-bad transition hover:bg-bad-soft">
                    <LogOut className="size-4" /> Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={cancelLogout}
        onConfirm={confirmLogout}
        title="Log out?"
        body="You'll need to sign in again to access your account."
        variant="warning"
        confirmLabel="Log out"
      />
    </header>
  );
}
