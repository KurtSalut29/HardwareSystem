"use client";

import { useEffect, useState } from "react";
import { Truck, CheckCircle2, Coffee } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { AVAILABILITY_LABEL, type DriverAvailability } from "@/lib/driverStatus";

type Status = { onDuty: boolean; active: number; maxActive: number; availability: DriverAvailability };

const LOOK: Record<DriverAvailability, { icon: React.ReactNode; chip: string; band: string; note: (s: Status) => string }> = {
  available: {
    icon: <CheckCircle2 className="size-5" />, chip: "bg-good-soft text-good", band: "from-good-soft",
    note: () => "The store can assign you a delivery.",
  },
  delivering: {
    icon: <Truck className="size-5" />, chip: "bg-brand-soft text-brand", band: "from-brand-soft",
    note: (s) => `${s.active} on hand. The store can add ${s.maxActive - s.active} more stop${s.maxActive - s.active === 1 ? "" : "s"}.`,
  },
  full: {
    icon: <Truck className="size-5" />, chip: "bg-brand-soft text-brand", band: "from-brand-soft",
    note: (s) => `${s.active} on hand. No new delivery until you finish ${s.active === 1 ? "it" : "one"}.`,
  },
  off_duty: {
    icon: <Coffee className="size-5" />, chip: "bg-recess text-ink-3", band: "from-recess",
    note: () => "You won't be assigned anything until you go back on duty.",
  },
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

  if (!status) return <div className="h-[84px] animate-pulse rounded-2xl border border-line bg-surface" />;
  const look = LOOK[status.availability];

  return (
    <div className={`flex items-center gap-3.5 rounded-2xl border border-line bg-gradient-to-r ${look.band} to-surface to-60% p-4`}>
      <span className={`relative grid size-12 shrink-0 place-items-center rounded-2xl ${look.chip}`}>
        {look.icon}
        {status.onDuty && (
          <span className="absolute -right-0.5 -top-0.5 flex size-3">
            <span className="animate-live-ping absolute inline-flex size-full rounded-full bg-good" />
            <span className="relative inline-flex size-3 rounded-full bg-good ring-2 ring-surface" />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-4">Your status</p>
        <p className="font-display text-[18px] font-extrabold leading-tight text-ink">{AVAILABILITY_LABEL[status.availability]}</p>
        <p className="text-[12.5px] leading-snug text-ink-3">{look.note(status)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1">
        <button type="button" onClick={toggle} disabled={saving} role="switch" aria-checked={status.onDuty}
          aria-label={status.onDuty ? "On duty — tap to go off duty" : "Off duty — tap to go on duty"}
          className={`relative h-7 w-[52px] rounded-full transition disabled:opacity-60 ${status.onDuty ? "bg-good" : "bg-line-strong"}`}>
          <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${status.onDuty ? "left-[26px]" : "left-0.5"}`} />
        </button>
        <span className={`text-[11px] font-bold ${status.onDuty ? "text-good" : "text-ink-4"}`}>{status.onDuty ? "On duty" : "Off duty"}</span>
      </div>
    </div>
  );
}
