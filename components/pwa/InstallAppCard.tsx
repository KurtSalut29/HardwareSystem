"use client";

import { Download, CheckCheck, Share, SquarePlus } from "lucide-react";
import { promptInstall, useInstallState } from "@/lib/pwa";
import { STORE_NAME } from "@/lib/brand";

/**
 * "Install app" for the Settings panel: a button where the browser supports
 * it, Add-to-Home-Screen steps on iPhone/iPad, and a note once installed.
 */
export default function InstallAppCard({ labelClass, fallback = false, bare = false }: {
  labelClass: string;
  /** Show browser-menu steps when the browser offers no install button. */
  fallback?: boolean;
  /** No top border, wider padding: for use inside a settings card. */
  bare?: boolean;
}) {
  const state = useInstallState();
  if (state === "unavailable" && !fallback) return null;

  return (
    <div className={bare ? "px-5 py-4" : "border-t border-line px-4 py-3.5"}>
      <p className={labelClass}>App</p>
      {state === "installed" ? (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-good-soft px-2.5 py-1 text-[12px] font-semibold text-good">
          <CheckCheck className="size-3.5" /> {STORE_NAME} is installed on this device
        </p>
      ) : state === "unavailable" ? (
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          This browser doesn&apos;t offer an install button here. In Chrome or Edge, open the browser menu (⋮) and choose <b className="text-ink-2">Install app</b> or <b className="text-ink-2">Add to Home screen</b>. On iPhone, use Safari: <b className="text-ink-2">Share → Add to Home Screen</b>.
        </p>
      ) : state === "available" ? (
        <>
          <p className="mb-2 text-[12px] text-ink-3">Open {STORE_NAME} from your home screen or taskbar, in its own window.</p>
          <button type="button" onClick={() => { void promptInstall(); }}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand text-[13px] font-semibold text-white transition hover:brightness-110">
            <Download className="size-4" /> Install app
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 text-[12px] text-ink-3">Add {STORE_NAME} to your home screen:</p>
          <ol className="space-y-1.5 text-[12.5px] text-ink-2">
            <li className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"><Share className="size-3.5" /></span>
              Tap <b className="font-semibold text-ink">Share</b> in Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"><SquarePlus className="size-3.5" /></span>
              Choose <b className="font-semibold text-ink">Add to Home Screen</b>
            </li>
          </ol>
        </>
      )}
    </div>
  );
}
