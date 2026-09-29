"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, Send, Inbox, FileText, CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import ReportSheet, { SheetSummary } from "@/components/reports/ReportSheet";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { roleLabel } from "@/lib/roles";

type Summary = SheetSummary & { periodStart: string; periodEnd: string };

type SentReport = {
  id: number;
  title: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  totalTransactions: number;
  itemsSold: number;
  cashTotal: number;
  gcashTotal: number;
  otherTotal: number;
  payload: string;
  note: string | null;
  status: string;
  createdAt: string;
  readAt: string | null;
  author: { id: number; username: string; role: string };
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const shiftISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const startOfMonthISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

// Calendar week starting Sunday, matching the day-of-week convention used
// elsewhere in the app (e.g. the Transactions calendar).
const startOfWeekISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function periodLabel(from: string, to: string) {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const fmt = (d: Date) => d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
  return from === to ? fmt(f) : `${fmt(f)} — ${fmt(t)}`;
}

export default function ReportsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { setRole(d.role ?? null); setUsername(d.username ?? ""); })
      .catch(() => setRole(null));
  }, []);

  if (role === null) {
    return <p className="text-sm py-16 text-center" style={{ color: "var(--text-faint)" }}>Loading…</p>;
  }
  if (role === "cashier") return <StaffReports username={username} />;
  if (role === "admin") return <AdminReports username={username} />;
  return <p className="text-sm py-16 text-center" style={{ color: "var(--text-faint)" }}>Reports aren&apos;t available for your account.</p>;
}

/* ================================================================== */
/* Staff (cashier) — compile a daily report, print it, send it to admin */
/* ================================================================== */

function StaffReports({ username }: { username: string }) {
  const showToast = useToast();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sent, setSent] = useState<SentReport[]>([]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reports/summary?from=${from}&to=${to}`);
    if (res.ok) setSummary(await res.json());
    setLoading(false);
  }, [from, to]);

  const loadSent = useCallback(async () => {
    const res = await fetch("/api/reports");
    if (res.ok) setSent(await res.json());
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadSent(); }, [loadSent]);

  async function handleSend() {
    setSending(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, note }),
    });
    setSending(false);
    setConfirmSend(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || "Couldn't send the report.", "error");
      return;
    }
    setNote("");
    loadSent();
    showToast("Accomplishment report sent to the admin.");
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={handleSend}
        title="Send this report to the admin?"
        body={`Your sales for ${periodLabel(from, to)} will be sent to the admin as an accomplishment report. The figures are locked in at the moment you send.`}
        variant="info"
        confirmLabel={sending ? "Sending…" : "Yes, Send Report"}
      />

      <div className="no-print">
        <PageHeader
          title="Sales & Accomplishment Report"
          subtitle="Compile your takings for a day, print a copy, and send it to the admin."
          action={
            <div className="flex gap-2">
              <Button variant="secondary" icon={<Printer size={ICON_SIZE.sm} />} onClick={() => window.print()} disabled={!summary}>
                Print
              </Button>
              <Button icon={<Send size={ICON_SIZE.sm} />} onClick={() => setConfirmSend(true)} disabled={!summary || loading}>
                Send to Admin
              </Button>
            </div>
          }
        />
      </div>

      <RangePicker from={from} to={to} setFrom={setFrom} setTo={setTo} />

      {loading || !summary ? (
        <SheetSkeleton />
      ) : (
        <ReportSheet
          title={from === to ? "Daily Sales Report" : "Sales Report"}
          scopeLabel="Accomplishment report"
          periodLabel={periodLabel(from, to)}
          preparedBy={`${username} (${roleLabel("cashier")})`}
          summary={summary}
          note={note}
        />
      )}

      {/* Remarks are part of the printed sheet above, edited here. */}
      <div className="no-print bg-white rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
        <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
          Remarks for the admin <span className="font-medium normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Anything the admin should know — stock that ran out, a refund, an unusual sale…"
          className="w-full text-sm border rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-4 transition"
          style={{ borderColor: "var(--border-strong)", ["--tw-ring-color" as string]: "var(--brand-soft)" }}
        />
        <p className="text-[11px] mt-1.5" style={{ color: "var(--text-faint)" }}>
          Whatever you type here appears on the printed sheet and is sent with the report.
        </p>
      </div>

      <SentList reports={sent} emptyText="You haven't sent any reports yet." />
    </div>
  );
}

/* ================================================================== */
/* Admin — store-wide sales report + the inbox of staff reports        */
/* ================================================================== */

function AdminReports({ username }: { username: string }) {
  const showToast = useToast();
  const [tab, setTab] = useState<"store" | "received">("store");
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [received, setReceived] = useState<SentReport[]>([]);
  const [open, setOpen] = useState<SentReport | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reports/summary?from=${from}&to=${to}`);
    if (res.ok) setSummary(await res.json());
    setLoading(false);
  }, [from, to]);

  const loadReceived = useCallback(async () => {
    const res = await fetch("/api/reports");
    if (res.ok) setReceived(await res.json());
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadReceived(); }, [loadReceived]);

  const unread = useMemo(() => received.filter((r) => r.status !== "read").length, [received]);

  async function markRead(r: SentReport) {
    if (r.status === "read") return;
    const res = await fetch("/api/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id }),
    });
    if (res.ok) { loadReceived(); showToast("Marked as read."); }
  }

  // A received report renders from its own snapshot, not from a fresh query.
  const openSummary: SheetSummary | null = useMemo(() => {
    if (!open) return null;
    let extra: { topProducts: SheetSummary["topProducts"]; lines: SheetSummary["lines"]; orders: SheetSummary["orders"] };
    try {
      extra = JSON.parse(open.payload);
    } catch {
      extra = { topProducts: [], lines: [], orders: { placed: 0, placedValue: 0, delivered: 0, cancelled: 0, outstandingBalance: 0 } };
    }
    return {
      totalSales: open.totalSales,
      totalTransactions: open.totalTransactions,
      itemsSold: open.itemsSold,
      cashTotal: open.cashTotal,
      gcashTotal: open.gcashTotal,
      otherTotal: open.otherTotal,
      topProducts: extra.topProducts ?? [],
      lines: extra.lines ?? [],
      orders: extra.orders ?? { placed: 0, placedValue: 0, delivered: 0, cancelled: 0, outstandingBalance: 0 },
    };
  }, [open]);

  return (
    <div className="space-y-5">
      <div className="no-print">
        <PageHeader
          title="Sales Reports"
          subtitle="The store's overall sales, and the accomplishment reports your staff have sent in."
          action={
            <Button variant="secondary" icon={<Printer size={ICON_SIZE.sm} />} onClick={() => window.print()}>
              Print
            </Button>
          }
        />

        <div className="flex gap-1 p-1 rounded-xl w-fit mb-4" style={{ background: "var(--bg-muted)" }}>
          <TabButton active={tab === "store"} onClick={() => { setTab("store"); setOpen(null); }} icon={<FileText size={ICON_SIZE.sm} />}>
            Store sales
          </TabButton>
          <TabButton active={tab === "received"} onClick={() => setTab("received")} icon={<Inbox size={ICON_SIZE.sm} />} badge={unread || undefined}>
            From staff
          </TabButton>
        </div>
      </div>

      {tab === "store" ? (
        <>
          <RangePicker from={from} to={to} setFrom={setFrom} setTo={setTo} />
          {loading || !summary ? (
            <SheetSkeleton />
          ) : (
            <ReportSheet
              title="Overall Sales Report"
              scopeLabel="Store-wide"
              periodLabel={periodLabel(from, to)}
              preparedBy={`${username} (Admin)`}
              summary={summary}
            />
          )}
        </>
      ) : open && openSummary ? (
        <>
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(null)}>← Back to inbox</Button>
            {open.status !== "read" && (
              <Button size="sm" icon={<CheckCircle2 size={ICON_SIZE.sm} />} onClick={() => markRead(open)}>
                Mark as read
              </Button>
            )}
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sent {new Date(open.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
          <ReportSheet
            title={open.title}
            scopeLabel="Received from staff"
            periodLabel={periodLabel(open.periodStart.slice(0, 10), open.periodEnd.slice(0, 10))}
            preparedBy={`${open.author.username} (${roleLabel(open.author.role)})`}
            summary={openSummary}
            note={open.note}
            generatedAt={open.createdAt}
          />
        </>
      ) : (
        <SentList
          reports={received}
          emptyText="No staff reports yet. They'll appear here as soon as a staff member sends one."
          onOpen={(r) => { setOpen(r); markRead(r); }}
          showAuthor
        />
      )}
    </div>
  );
}

/* ============================== shared ============================== */

function TabButton({ active, onClick, icon, badge, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; badge?: number; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition"
      style={active
        ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "0 1px 2px rgba(16,24,64,0.08)" }
        : { color: "var(--text-muted)" }}
    >
      {icon}
      {children}
      {badge != null && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white num" style={{ background: "var(--brand)" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// Daily / Weekly / Monthly presets plus the date inputs above them for a
// user-defined custom period — both admin and staff get the same set, since
// both generate reports day to day.
function RangePicker({ from, to, setFrom, setTo }: {
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
}) {
  const presets: { label: string; apply: () => void }[] = [
    { label: "Today", apply: () => { setFrom(todayISO()); setTo(todayISO()); } },
    { label: "Yesterday", apply: () => { setFrom(shiftISO(-1)); setTo(shiftISO(-1)); } },
    { label: "This Week", apply: () => { setFrom(startOfWeekISO()); setTo(todayISO()); } },
    { label: "This Month", apply: () => { setFrom(startOfMonthISO()); setTo(todayISO()); } },
  ];

  return (
    <div className="no-print bg-white rounded-2xl border p-4 flex flex-wrap items-end gap-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mr-1">
        <CalendarDays size={ICON_SIZE.md} style={{ color: "var(--brand)" }} />
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Period</span>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>From</label>
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition"
          style={{ borderColor: "var(--border-strong)", ["--tw-ring-color" as string]: "var(--brand-soft)" }} />
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>To</label>
        <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition"
          style={{ borderColor: "var(--border-strong)", ["--tw-ring-color" as string]: "var(--brand-soft)" }} />
      </div>
      <div className="flex flex-wrap gap-1.5 ml-auto">
        {presets.map((p) => (
          <button key={p.label} onClick={p.apply}
            className="px-3 py-2 rounded-lg text-xs font-bold border transition hover:bg-[color:var(--bg-muted)]"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div className="bg-white rounded-2xl border p-8 flex items-center justify-center gap-2" style={{ borderColor: "var(--border)", minHeight: 320 }}>
      <Loader2 size={ICON_SIZE.md} className="animate-spin" style={{ color: "var(--brand)" }} />
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>Compiling figures…</span>
    </div>
  );
}

function SentList({ reports, emptyText, onOpen, showAuthor }: {
  reports: SentReport[]; emptyText: string; onOpen?: (r: SentReport) => void; showAuthor?: boolean;
}) {
  return (
    <div className="no-print bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="font-display text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
          {showAuthor ? "Reports received" : "Reports you've sent"}
        </h2>
      </div>
      {reports.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here yet" description={emptyText} />
      ) : (
        <ul>
          {reports.map((r) => {
            const row = (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{r.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {showAuthor && <>{r.author.username} · </>}
                    {new Date(r.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                    {" · "}{r.totalTransactions} transaction{r.totalTransactions === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="font-display text-base font-extrabold num shrink-0" style={{ color: "var(--text-primary)" }}>
                  ₱{r.totalSales.toFixed(2)}
                </p>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={r.status === "read"
                    ? { background: "var(--good-soft)", color: "var(--good)" }
                    : { background: "var(--brand-soft)", color: "var(--brand)" }}
                >
                  {r.status === "read" ? "Read" : "Sent"}
                </span>
              </div>
            );
            return (
              <li key={r.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                {onOpen ? (
                  <button onClick={() => onOpen(r)} className="w-full text-left transition hover:bg-[color:var(--bg-subtle)]">
                    {row}
                  </button>
                ) : row}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
