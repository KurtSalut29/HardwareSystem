"use client";

import { Clock, Check } from "lucide-react";
import { canTakeOrder, type DriverAvailability } from "@/lib/driverStatus";

export type DriverPick = { id: number; username: string; activeCount: number; maxActive: number; availability: DriverAvailability };

const DRIVER_NOTE: Record<DriverAvailability, (d: DriverPick) => string> = {
  available: () => "Available now",
  delivering: (d) => `On the road · ${d.maxActive - d.activeCount} more allowed`,
  full: (d) => `Busy · ${d.activeCount} on the road`,
  off_duty: () => "Off duty",
};

/** Who takes the delivery: a driver now, or nobody yet (assigned later from the order list). */
export default function DriverPicker({ drivers, value, onChange, loadFailed = false }: {
  drivers: DriverPick[];
  value: string;
  onChange: (v: string) => void;
  loadFailed?: boolean;
}) {
  const card = (selected: boolean, disabled: boolean) =>
    `relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
      disabled ? "cursor-not-allowed border-line bg-subtle opacity-60"
      : selected ? "border-brand bg-brand-soft ring-2 ring-brand/15"
      : "border-line bg-surface hover:border-brand/40"}`;
  const tick = (selected: boolean) => selected && (
    <span className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-brand text-white"><Check className="size-3" strokeWidth={3} /></span>
  );
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-ink-2">Driver</p>
      <div role="radiogroup" aria-label="Driver" className="grid gap-2 sm:grid-cols-2">
        <button type="button" role="radio" aria-checked={value === ""} onClick={() => onChange("")} className={card(value === "", false)}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-recess text-ink-3"><Clock className="size-4" /></span>
          <span className="min-w-0 pr-6">
            <span className="block text-[13px] font-semibold text-ink">Assign later</span>
            <span className="block text-[11.5px] text-ink-4">Pick a driver from the order list</span>
          </span>
          {tick(value === "")}
        </button>
        {drivers.map((d) => {
          const ok = canTakeOrder(d.availability);
          const selected = value === String(d.id);
          const tone = d.availability === "available" ? "good" : d.availability === "delivering" ? "brand" : "muted";
          return (
            <button key={d.id} type="button" role="radio" aria-checked={selected} disabled={!ok} onClick={() => onChange(String(d.id))} className={card(selected, !ok)}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold uppercase ${ok ? "bg-brand-soft text-brand-ink" : "bg-recess text-ink-4"}`}>{d.username.slice(0, 1)}</span>
              <span className="min-w-0 pr-6">
                <span className="block truncate text-[13px] font-semibold text-ink">{d.username}</span>
                <span className={`flex items-center gap-1 text-[11.5px] ${tone === "good" ? "text-good" : tone === "brand" ? "text-brand-ink" : "text-ink-4"}`}>
                  <span className={`size-1.5 rounded-full ${tone === "good" ? "bg-good" : tone === "brand" ? "bg-brand" : "bg-ink-4"}`} />
                  {DRIVER_NOTE[d.availability](d)}
                </span>
              </span>
              {tick(selected)}
            </button>
          );
        })}
      </div>
      {loadFailed && <p className="text-[11px] text-warn">Couldn&apos;t load the drivers. You can still assign one from the order list.</p>}
      {!loadFailed && drivers.length === 0 && <p className="text-[11px] text-ink-4">No drivers registered yet.</p>}
      {value && <p className="text-[11px] text-ink-3">The order goes out for delivery right away, and the driver gets an alert.</p>}
    </div>
  );
}
