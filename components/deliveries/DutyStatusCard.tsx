"use client";

import { useEffect, useState } from "react";
import { Power, Truck, CheckCircle2, Coffee } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { AVAILABILITY_LABEL, type DriverAvailability } from "@/lib/driverStatus";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type Status = { onDuty: boolean; active: number; maxActive: number; availability: DriverAvailability };

const LOOK: Record<DriverAvailability, { icon: React.ReactNode; bg: string; fg: string; note: (s: Status) => string }> = {
  available: { icon: <CheckCircle2 size={ICON_SIZE.md} />, bg: "var(--good-soft)", fg: "var(--good)", note: () => "The store can assign you a delivery." },
  delivering: {
    icon: <Truck size={ICON_SIZE.md} />, bg: "var(--info-soft)", fg: "var(--brand-ink)",
    note: (s) => `${s.active} on hand. The store can add ${s.maxActive - s.active} more stop${s.maxActive - s.active === 1 ? "" : "s"}.`,
  },
  full: {
    icon: <Truck size={ICON_SIZE.md} />, bg: "var(--info-soft)", fg: "var(--brand-ink)",
    note: (s) => `${s.active} on hand. No new delivery is assigned until you finish ${s.active === 1 ? "it" : "one"}.`,
  },
  off_duty: { icon: <Coffee size={ICON_SIZE.md} />, bg: "var(--bg-muted)", fg: "var(--text-muted)", note: () => "You won't be assigned anything until you go back on duty." },
};

/**
 * The driver's own status: available, on delivery, busy (at the most deliveries
 * allowed at once), or off duty. Going off duty (a break, end of shift) stops new
 * assignments; the store sees the same status when choosing a driver.
 */
export default function DutyStatusCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const showToast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/driver/status").then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setStatus(d); }).catch(() => {});
    return () => { live = false; };
  }, [refreshKey]);

  async function toggle() {
    if (!status) return;
    setSaving(true);
    const res = await fetch("/api/driver/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ onDuty: !status.onDuty }) });
    setSaving(false);
    if (!res.ok) { showToast("Couldn't change your status.", "error"); return; }
    const next: Status = await res.json();
    setStatus(next);
    showToast(next.onDuty ? "You're on duty — the store can assign you deliveries." : "You're off duty — no new deliveries will be assigned.", next.onDuty ? "success" : "info");
  }

  if (!status) return null;
  const look = LOOK[status.availability];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: look.bg, color: look.fg }}>{look.icon}</span>
      <div className="flex-1 min-w-[180px]">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Your status</p>
        <p className="font-display font-extrabold text-gray-900">{AVAILABILITY_LABEL[status.availability]}</p>
        <p className="text-xs text-gray-500">{look.note(status)}</p>
      </div>
      <button onClick={toggle} disabled={saving} role="switch" aria-checked={status.onDuty}
        className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition disabled:opacity-60"
        style={status.onDuty
          ? { borderColor: "var(--border)", color: "var(--text-secondary)" }
          : { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }}>
        <Power size={ICON_SIZE.xs} /> {status.onDuty ? "Go off duty" : "Go on duty"}
      </button>
    </div>
  );
}
