/**
 * Desktop (system) notifications, so a new order still gets noticed when staff
 * are on another tab or another app. The in-page toast and sound only reach
 * someone looking at this tab; these pop up from Windows / macOS / Android.
 *
 * The browser asks the person once ("Allow notifications?"); after that they
 * appear only while this tab is hidden or unfocused, so nobody gets the same
 * alert twice.
 */

export type DesktopPermission = NotificationPermission | "unsupported";

export function desktopPermission(): DesktopPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestDesktop(): Promise<DesktopPermission> {
  if (desktopPermission() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return desktopPermission();
  }
}

/** Shows a system notification if allowed and the person isn't looking at this tab. */
export function showDesktop({ title, body, tag, href }: { title: string; body: string; tag: string; href?: string }) {
  if (desktopPermission() !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  try {
    const n = new Notification(`RM Hardware · ${title}`, { body, tag, icon: "/favicon.ico" });
    n.onclick = () => {
      window.focus();
      if (href && window.location.pathname !== href) window.location.assign(href);
      n.close();
    };
  } catch { /* some mobile browsers only allow notifications from a service worker */ }
}
