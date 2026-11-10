"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, Package, PackageX } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { ReorderPlan, ReorderRow } from "@/lib/inventory";
import { ICON_SIZE } from "@/lib/constants/icon-size";

/** How long "Remind me later" keeps the reminder away. */
const SNOOZE_MS = 2 * 60 * 60 * 1000;
const SHOW_TOP = 5;

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const storageKey = (username: string) => `reorder-reminder:${username}`;

type Stored = { handledDay?: string; snoozedUntil?: number };

function readStored(username: string): Stored {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(username)) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function writeStored(username: string, value: Stored) {
  try { localStorage.setItem(storageKey(username), JSON.stringify(value)); } catch { /* storage blocked: it asks again next load */ }
}

/** Same ordering as needsAttention() on the server: out of stock first, then closest to running out. */
function urgentFirst(rows: ReorderRow[]) {
  const rank = { out: 0, reorder: 1, ok: 2 } as const;
  return rows
    .filter((r) => r.status !== "ok")
    .sort((a, b) => rank[a.status] - rank[b.status] || a.stock / a.reorderPoint - b.stock / b.reorderPoint);
}

/**
 * Once a day, when an admin or staff member opens the system and products are at
 * or below their reorder point, a pop-up lists the most urgent ones with the EOQ
 * order quantity. Opening the restock plan settles it for the day; "Remind me
 * later" brings it back after two hours. The bell and toasts still cover changes
 * during the day, so the pop-up never repeats on every stock movement.
 */
export default function ReorderReminder({ role, username }: { role: string; username: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [rows, setRows] = useState<ReorderRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const enabled = role === "admin" || role === "cashier";

  useEffect(() => {
    if (!enabled) return;
    const stored = readStored(username);
    if (stored.handledDay === dayKey() || (stored.snoozedUntil ?? 0) > Date.now()) return;
    if (pathname?.startsWith("/restocks")) return;

    let cancelled = false;
    // Let the page itself load first; the reminder is secondary.
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/inventory/reorder");
        if (!res.ok || cancelled) return;
        const plan: ReorderPlan = await res.json();
        const urgent = urgentFirst(plan.rows);
        if (cancelled || urgent.length === 0) return;
        setRows(urgent);
        setOpen(true);
      } catch { /* offline: try again next load */ }
    }, 1200);
    return () => { cancelled = true; clearTimeout(t); };
    // Checked once per app load; navigating between pages must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, username]);

  if (!enabled || !rows) return null;

  const outCount = rows.filter((r) => r.status === "out").length;
  const top = rows.slice(0, SHOW_TOP);

  function snooze() {
    writeStored(username, { ...readStored(username), snoozedUntil: Date.now() + SNOOZE_MS });
    setOpen(false);
  }

  function openPlan() {
    writeStored(username, { handledDay: dayKey() });
    setOpen(false);
    router.push("/restocks");
  }

  return (
    <Modal open={open} onClose={snooze} title="Time to reorder" size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl px-3.5 py-3" style={{ background: "var(--warn-soft)" }}>
          <AlertTriangle size={ICON_SIZE.md} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{rows.length} product{rows.length === 1 ? " is" : "s are"}</span> at or below
            the reorder point{outCount > 0 && <>, and <span className="font-semibold" style={{ color: "var(--bad)" }}>{outCount} {outCount === 1 ? "is" : "are"} out of stock</span></>}.
            Order now so they arrive before they run out.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {rows.length > SHOW_TOP ? `Most urgent ${SHOW_TOP}` : "Products to order"}
          </p>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {top.map((r) => (
              <li key={r.productId} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {r.image
                    ? <Image src={r.image} alt="" width={36} height={36} className="w-full h-full object-cover" />
                    : r.status === "out" ? <PackageX size={16} className="text-gray-300" /> : <Package size={16} className="text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {r.status === "out"
                      ? <span className="font-semibold" style={{ color: "var(--bad)" }}>Out of stock</span>
                      : <>{fmt(r.stock)} {r.unit} left · reorder at {fmt(r.reorderPoint)}</>}
                    {r.daysLeft != null && r.status !== "out" && <> · ~{Math.max(0, Math.floor(r.daysLeft))} day{Math.floor(r.daysLeft) === 1 ? "" : "s"} left</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Order</p>
                  <p className="text-sm font-bold text-gray-900 num">{r.eoq != null ? `${fmt(r.eoq)} ${r.unit}` : "—"}</p>
                </div>
              </li>
            ))}
          </ul>
          {rows.length > SHOW_TOP && (
            <p className="text-[11px] text-gray-400 mt-2">+ {rows.length - SHOW_TOP} more in the restock plan.</p>
          )}
          <p className="text-[11px] text-gray-400 mt-2">&ldquo;Order&rdquo; is the EOQ suggestion from recent sales.</p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="secondary" onClick={snooze}>Remind me later</Button>
          <Button onClick={openPlan}>Open restock plan</Button>
        </div>
      </div>
    </Modal>
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
