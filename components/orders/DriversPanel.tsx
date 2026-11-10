"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Truck, MapPin, Phone, CheckCheck, SignalLow, Search } from "lucide-react";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { AVAILABILITY_LABEL, type DriverAvailability } from "@/lib/driverStatus";

export type DriverInfo = {
  id: number;
  username: string;
  contact?: string | null;
  activeCount: number;
  activeOrders?: { id: number; customer: string; address: string | null; assignedAt: string | null }[];
  deliveredToday?: number;
  lastLocation?: { lat: number; lng: number; updatedAt: string } | null;
  onDuty?: boolean;
  maxActive?: number;
  availability?: DriverAvailability;
};

/** A driver on the road is "offline" once their phone stops sending a position for this long. */
export const STALE_MS = 10 * 60 * 1000;

type DriverState = DriverAvailability;

export function driverState(d: DriverInfo): DriverState {
  return d.availability ?? (d.activeCount > 0 ? "full" : "available");
}

/** On the road but the phone stopped sending a position. */
export function noSignal(d: DriverInfo, now: number) {
  return d.activeCount > 0 && !(d.lastLocation && now - new Date(d.lastLocation.updatedAt).getTime() <= STALE_MS);
}

const STATE_STYLE: Record<DriverState, { label: string; bg: string; fg: string; dot: string }> = {
  available: { label: AVAILABILITY_LABEL.available, bg: "var(--good-soft)", fg: "var(--good)", dot: "var(--good)" },
  delivering: { label: AVAILABILITY_LABEL.delivering, bg: "var(--info-soft)", fg: "var(--brand-ink)", dot: "var(--brand)" },
  full: { label: "Busy", bg: "var(--info-soft)", fg: "var(--brand-ink)", dot: "var(--brand)" },
  off_duty: { label: AVAILABILITY_LABEL.off_duty, bg: "var(--bg-muted)", fg: "var(--text-muted)", dot: "#9CA3AF" },
};

/** A driver's status as a small pill, for order rows and lists. */
export function DriverStatusChip({ driver }: { driver: DriverInfo }) {
  const s = driverState(driver);
  const st = STATE_STYLE[s];
  const showCount = driver.maxActive && driver.maxActive > 1 && driver.activeCount > 0;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap align-middle"
      style={{ background: st.bg, color: st.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
      {st.label}{showCount ? ` ${driver.activeCount}/${driver.maxActive}` : ""}
    </span>
  );
}

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Free drivers first, then those still able to take a stop, then busy, then off duty. */
const ORDER: DriverState[] = ["available", "delivering", "full", "off_duty"];

/** Past this many drivers the search box shows up. */
const SEARCH_FROM = 6;

/** Drivers per page, so the panel stays the same height however many there are. */
const PER_PAGE = 5;

/**
 * Who is free, who is on the road, and where they last were. Lets staff pick a
 * free driver before assigning, and spot a driver whose phone stopped reporting.
 *
 * Built for a long roster: one compact row per driver, filter chips by status,
 * a search box once there are several drivers, and pages of five so the Orders
 * page doesn't grow with every driver added.
 */
export default function DriversPanel({ drivers, now, onShowOnMap, loadError = false, onRetry }: {
  drivers: DriverInfo[];
  /** The list couldn't be loaded: say so instead of "no drivers". */
  loadError?: boolean;
  onRetry?: () => void;
  /** Passed in so the "x min ago" labels move with the page's poll. */
  now: number;
  onShowOnMap: (d: DriverInfo) => void;
}) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<DriverState | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const rows = drivers.map((d) => ({ d, s: driverState(d) }));
  const count = (s: DriverState) => rows.filter((r) => r.s === s).length;
  const q = query.trim().toLowerCase();
  const shown = rows
    .filter((r) => filter === "all" || r.s === filter)
    .filter((r) => !q || r.d.username.toLowerCase().includes(q) || (r.d.contact ?? "").includes(q)
      || (r.d.activeOrders ?? []).some((o) => String(o.id).includes(q) || o.customer.toLowerCase().includes(q)))
    .sort((a, b) => ORDER.indexOf(a.s) - ORDER.indexOf(b.s) || a.d.username.localeCompare(b.d.username));
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  // A poll can shrink the list under the current page; stay on the last real one.
  const current = Math.min(page, pages);
  const pageRows = shown.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-3 hover:bg-gray-50 transition text-left">
        <Truck size={ICON_SIZE.sm} className="text-gray-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-700">Drivers{drivers.length > 0 && <span className="text-gray-400 font-normal"> · {drivers.length}</span>}</span>
        {ORDER.map((s) => count(s) > 0 && (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: STATE_STYLE[s].bg, color: STATE_STYLE[s].fg }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_STYLE[s].dot }} />
            {count(s)} {STATE_STYLE[s].label.toLowerCase()}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400">
          {open ? "Hide" : "Show"}
          {open ? <ChevronUp size={ICON_SIZE.sm} /> : <ChevronDown size={ICON_SIZE.sm} />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {loadError && drivers.length === 0 ? (
            <p className="text-xs py-2 flex flex-wrap items-center gap-2" style={{ color: "var(--warn)" }}>
              Couldn&apos;t load the drivers right now.
              {onRetry && <button onClick={onRetry} className="font-semibold text-blue-600 hover:underline">Try again</button>}
            </p>
          ) : drivers.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No driver accounts yet. Add one on the Users page.</p>
          ) : (
            <>
              {/* Filter by status, and search once the roster is long */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter drivers by status">
                  {(["all", ...ORDER] as const).map((s) => {
                    const n = s === "all" ? drivers.length : count(s);
                    if (s !== "all" && n === 0) return null;
                    const on = filter === s;
                    return (
                      <button key={s} onClick={() => { setFilter(s); setPage(1); }} aria-pressed={on}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        {s === "all" ? "All" : STATE_STYLE[s].label} <span className={on ? "text-white/80" : "text-gray-400"}>{n}</span>
                      </button>
                    );
                  })}
                </div>
                {drivers.length >= SEARCH_FROM && (
                  <div className="relative ml-auto w-full sm:w-56">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} aria-label="Search drivers"
                      placeholder="Search driver, phone or order #"
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                )}
              </div>

              {shown.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No driver matches.</p>
              ) : (
                <>
                <ul aria-label="Drivers" className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                  {pageRows.map(({ d, s }) => {
                    const st = STATE_STYLE[s];
                    const active = d.activeOrders ?? [];
                    return (
                      <li key={d.id} className="px-3 py-2.5 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1.5 text-[11px]">
                        {/* Who */}
                        <div className="flex items-center gap-2.5 min-w-0 md:w-48 shrink-0">
                          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: "var(--brand)" }}>
                            {d.username.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{d.username}</p>
                            {d.contact && (
                              <a href={`tel:${d.contact}`} className="text-gray-500 hover:text-blue-600 inline-flex items-center gap-1 num">
                                <Phone size={10} /> {d.contact}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex flex-col items-start gap-0.5 md:w-32 shrink-0 ml-auto md:ml-0">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: st.bg, color: st.fg }}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s === "delivering" || s === "full" ? "animate-pulse" : ""}`} style={{ background: st.dot }} />
                            {st.label}{d.maxActive && d.maxActive > 1 && d.activeCount > 0 ? ` ${d.activeCount}/${d.maxActive}` : ""}
                          </span>
                          {noSignal(d, now) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap" style={{ color: "var(--warn)" }}>
                              <SignalLow size={10} /> No GPS signal
                            </span>
                          )}
                        </div>

                        {/* What they're carrying */}
                        <div className="min-w-0 flex-1 basis-full md:basis-auto text-gray-500">
                          {active.length > 0 ? (
                            <p className="truncate" title={active.map((o) => `#${o.id} ${o.customer}${o.address ? ` (${o.address})` : ""}`).join("\n")}>
                              <span className="font-semibold text-gray-700">#{active[0].id}</span> · {active[0].customer}
                              {active[0].address && <span className="text-gray-400"> · {active[0].address}</span>}
                              {active.length > 1 && <span className="font-semibold text-gray-600"> +{active.length - 1} more</span>}
                            </p>
                          ) : (
                            <p className="text-gray-400">{s === "off_duty" ? "Off duty — can't be assigned" : "Free to assign"}</p>
                          )}
                          <p className="inline-flex items-center gap-1 text-gray-400">
                            <CheckCheck size={11} /> {d.deliveredToday ?? 0} delivered today
                          </p>
                        </div>

                        {/* Where */}
                        <div className="flex items-center gap-2 shrink-0 md:justify-end md:w-44">
                          <span className="text-gray-400 whitespace-nowrap">
                            {d.lastLocation ? <>Seen {ago(d.lastLocation.updatedAt, now)}</> : "No location yet"}
                          </span>
                          {d.lastLocation && (
                            <button onClick={() => onShowOnMap(d)} aria-label={`Show ${d.username} on the map`}
                              className="shrink-0 inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition">
                              <MapPin size={11} /> Map
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {pages > 1 && (
                  <div className="flex items-center justify-between gap-2 mt-2 text-xs text-gray-500">
                    <span className="num">{(current - 1) * PER_PAGE + 1}–{Math.min(current * PER_PAGE, shown.length)} of {shown.length} drivers</span>
                    <div className="flex items-center gap-1" role="navigation" aria-label="Driver pages">
                      <button onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous drivers"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition">
                        <ChevronLeft size={ICON_SIZE.xs} />
                      </button>
                      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                        <button key={n} onClick={() => setPage(n)} aria-current={n === current ? "page" : undefined}
                          className={`min-w-7 h-7 px-2 rounded-lg text-xs font-semibold transition num ${n === current ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          {n}
                        </button>
                      ))}
                      <button onClick={() => setPage(current + 1)} disabled={current === pages} aria-label="Next drivers"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition">
                        <ChevronRight size={ICON_SIZE.xs} />
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
