"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";

/** Pages anyone can open without signing in: a 401 there is normal, not an expired session. */
const PUBLIC_PATHS = ["/", "/login", "/signup"];
/** API calls that answer 401 on purpose (wrong password, not signed in yet). */
const QUIET_401 = ["/api/auth/login", "/api/auth/register", "/api/auth/me"];

let patched = false;
let sessionNoticeShown = false;

/**
 * Feedback the whole app shares, so nothing fails silently:
 *  - going offline / back online
 *  - a request that couldn't reach the server at all
 *  - a session that expired mid-use (sends the person back to sign in)
 * Mounted once, inside the toast provider.
 */
export default function SystemFeedback() {
  const showToast = useToast();

  useEffect(() => {
    const offline = () => showToast("You're offline. Changes won't save until your connection is back.", "warning");
    const online = () => showToast("You're back online.", "success");
    const unreachable = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      if (r instanceof TypeError && /fetch|network|load failed/i.test(r.message)) {
        showToast(navigator.onLine ? "Couldn't reach the server. Try again in a moment." : "You're offline. Check your connection and try again.", "error");
      }
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("unhandledrejection", unreachable);

    if (!patched) {
      patched = true;
      const original = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await original(input, init);
        try {
          if (res.status === 401 && !sessionNoticeShown) {
            const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
            const onAppPage = !PUBLIC_PATHS.includes(window.location.pathname);
            if (url.origin === window.location.origin && url.pathname.startsWith("/api/") && !QUIET_401.includes(url.pathname) && onAppPage) {
              sessionNoticeShown = true;
              showToast("Your session ended. Please sign in again — taking you to the sign-in page.", "warning");
              setTimeout(() => {
                window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
              }, 2200);
            }
          }
        } catch { /* never let the safety net break a request */ }
        return res;
      };
    }

    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("unhandledrejection", unreachable);
    };
  }, [showToast]);

  return null;
}
