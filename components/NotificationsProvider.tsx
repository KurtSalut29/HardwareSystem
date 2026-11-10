"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { ToastVariant } from "@/components/ui/Toast";
import { loudestOf, playAlert, unlockAudio } from "@/lib/sounds";
import { SOUND_FOR, type AppNotification, type NotificationType } from "@/lib/notifications";

type NotificationsValue = {
  items: AppNotification[];
  unread: number;
  isUnread: (key: string) => boolean;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsValue>({
  items: [],
  unread: 0,
  isUnread: () => false,
  markAllRead: () => {},
});

export const useNotifications = () => useContext(NotificationsContext);

/** Roles with a notification feed. Drivers have their own delivery alerts. */
const FEED_ROLES = ["admin", "cashier", "customer"];
const POLL_MS = 15000;
const MAX_REMEMBERED = 300;

const TOAST_VARIANT: Record<NotificationType, ToastVariant> = {
  new_order: "info",
  order_update: "success",
  low_stock: "warning",
  out_of_stock: "error",
};

function storageKey(username: string) {
  return `notifications-seen:${username}`;
}

function readSeen(username: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(username)) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(username: string, keys: string[]) {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(keys.slice(-MAX_REMEMBERED)));
  } catch { /* storage blocked: they show as unread again next visit */ }
}

/**
 * Polls the role's notification feed, keeps the bell's unread count, and plays
 * a sound (plus a toast) when something new arrives while the page is open.
 * What was already there on page load is shown in the bell but doesn't ring.
 */
export default function NotificationsProvider({ role, username, children }: { role: string; username: string; children: React.ReactNode }) {
  const active = FEED_ROLES.includes(role);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(username));
  const knownRef = useRef<Set<string> | null>(null);
  const showToast = useToast();

  // Browsers only allow sound after an interaction; any click or key press unlocks it.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const poll = useCallback(async () => {
    let next: AppNotification[];
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      next = Array.isArray(data.items) ? data.items : [];
    } catch {
      return; // network blip: the next tick retries
    }

    const known = knownRef.current;
    knownRef.current = new Set(next.map((n) => n.key));
    setItems(next);

    if (!known) return; // first load: show, but don't ring for what was already there
    const fresh = next.filter((n) => !known.has(n.key));
    if (fresh.length === 0) return;

    const sound = loudestOf(fresh.map((n) => SOUND_FOR[n.type]));
    if (sound) playAlert(sound);
    const first = fresh[0];
    showToast(
      fresh.length === 1 ? `${first.title}: ${first.message}` : `${fresh.length} new notifications`,
      TOAST_VARIANT[first.type],
    );
  }, [showToast]);

  useEffect(() => {
    if (!active) return;
    const first = setTimeout(poll, 0);
    const timer = setInterval(poll, POLL_MS);
    // Catch up straight away when someone comes back to the tab.
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, poll]);

  const markAllRead = useCallback(() => {
    setSeen((prev) => {
      const current = items.map((n) => n.key);
      if (current.every((k) => prev.has(k))) return prev;
      const merged = new Set([...prev, ...current]);
      writeSeen(username, [...merged]);
      return merged;
    });
  }, [items, username]);

  const isUnread = useCallback((key: string) => !seen.has(key), [seen]);
  const unread = items.filter((n) => !seen.has(n.key)).length;

  return (
    <NotificationsContext.Provider value={{ items, unread, isUnread, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}
