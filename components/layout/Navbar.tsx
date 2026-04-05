"use client";

import { Bell, ChevronDown, Package, ShoppingBag, Settings, Sun, Moon, Monitor, Menu } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";

type Notification = { id: string; type: "low_stock" | "new_order"; message: string };

export default function Navbar({ username, role, onMenuClick }: { username: string; role: string; onMenuClick: () => void }) {
  const { theme, toggle } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const roleStyle: Record<string, string> = {
    admin: "bg-purple-50 text-purple-600 border border-purple-100",
    cashier: "bg-blue-50 text-blue-600 border border-blue-100",
    customer: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  };

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

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="h-[57px] bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-6 shrink-0">
      {/* Hamburger — mobile only */}
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
        <Menu size={18} />
      </button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-1 ml-auto">

        {/* Notifications — admin only */}
        {role === "admin" && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifs(!showNotifs); setUnread(0); }}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400"
            >
              <Bell size={16} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="fixed left-2 right-2 top-[57px] md:absolute md:left-auto md:right-0 md:top-full md:mt-1.5 md:w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Notifications</p>
                  {notifs.length > 0 && <span className="text-xs text-gray-400">{notifs.length} alerts</span>}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">No notifications</div>
                  ) : notifs.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${n.type === "low_stock" ? "bg-orange-50 text-orange-500" : "bg-blue-50 text-blue-500"}`}>
                        {n.type === "low_stock" ? <Package size={13} /> : <ShoppingBag size={13} />}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400"
          >
            <Settings size={16} />
          </button>

          {showSettings && (
            <div className="fixed left-2 right-2 top-[57px] md:absolute md:left-auto md:right-0 md:top-full md:mt-1.5 md:w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">Settings</p>
              </div>

              {/* Appearance */}
              <div className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Appearance</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggle("light")}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg border text-xs font-medium transition ${theme === "light" ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  >
                    <Sun size={14} />
                    Light
                  </button>
                  <button
                    onClick={() => toggle("dark")}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg border text-xs font-medium transition ${theme === "dark" ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  >
                    <Moon size={14} />
                    Dark
                  </button>
                  <button
                    onClick={() => {
                      const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                      toggle(sys);
                      localStorage.removeItem("theme");
                    }}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-medium transition"
                  >
                    <Monitor size={14} />
                    System
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-800 leading-none">{username}</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5 inline-block ${roleStyle[role] ?? "bg-gray-100 text-gray-500"}`}>
                {role}
              </span>
            </div>
            <ChevronDown size={13} className="text-gray-400" />
          </button>

          {showProfile && (
            <div className="fixed left-2 right-2 top-[57px] md:absolute md:left-auto md:right-0 md:top-full md:mt-1.5 md:w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">{username}</p>
                <p className="text-xs text-gray-400 capitalize">{role}</p>
              </div>
              <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
