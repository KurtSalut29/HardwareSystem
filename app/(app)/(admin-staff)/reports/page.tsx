"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, Send, Inbox, FileText, CalendarDays, CheckCircle2, Loader2, MessageSquareText } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import ReportSheet, { SheetSummary } from "@/components/reports/ReportSheet";
import Segmented from "@/components/ui/Segmented";
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
    return <SheetSkeleton />;
  }
  if (role === "cashier") return <StaffReports username={username} />;
  if (role === "admin") return <AdminReports username={username} />;
  return <p className="py-16 text-center text-sm text-ink-4">Reports aren&apos;t available for your account.</p>;
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
    <div className="space-y-6">
      <ConfirmModal
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={handleSend}
        title="Send this report to the admin?"
        body={`Your sales for ${periodLabel(from, to)} will be sent to the admin as an accomplishment report. The figures are locked in at the moment you send.`}
        variant="info"
        confirmLabel={sending ? "Sending…" : "Yes, send report"}
      />

      <div className="no-print">
        <PageHeader
          eyebrow="Reporting"
          title="Sales report"
          subtitle="Compile your takings for a day, print a copy, and send it to the admin."
          action={
            <>
              <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()} disabled={!summary}>
                Print
              </Button>
              <Button icon={<Send className="size-4" />} onClick={() => setConfirmSend(true)} disabled={!summary || loading}>
                Send to admin
              </Button>
            </>
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
      <div className="no-print rounded-2xl border border-line bg-surface p-5">
        <label htmlFor="report-note" className="mb-2 flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><MessageSquareText className="size-4" /></span>
          Remarks for the admin <span className="font-sans text-xs font-medium text-ink-4">optional</span>
        </label>
        <textarea
          id="report-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Anything the admin should know — stock that ran out, a refund, an unusual sale…"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
        />
        <p className="mt-1.5 text-[11.5px] text-ink-4">
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
    else showToast("Couldn't mark it as read. Try again.", "error");
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
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          eyebrow="Reporting"
          title="Sales reports"
          subtitle="The store's overall sales, and the accomplishment reports your staff have sent in."
          action={
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
          }
        />

        <div className="mt-5">
          <Segmented label="Report" value={tab}
            onChange={(k) => { setTab(k); if (k === "store") setOpen(null); }}
            options={[
              { key: "store", label: "Store sales", icon: <FileText className="size-4" /> },
              { key: "received", label: "From staff", icon: <Inbox className="size-4" />, count: unread || undefined },
            ]} />
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
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="size-3.5" />} onClick={() => setOpen(null)}>Back to inbox</Button>
            {open.status !== "read" && (
              <Button variant="soft" size="sm" icon={<CheckCircle2 className="size-3.5" />} onClick={() => markRead(open)}>
                Mark as read
              </Button>
            )}
            <span className="text-xs text-ink-3">
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

// Daily / Weekly / Monthly presets plus date inputs for a custom period —
// admin and staff get the same set, since both generate reports day to day.
function RangePicker({ from, to, setFrom, setTo }: {
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
}) {
  const presets: { key: string; label: string; from: string; to: string }[] = [
    { key: "today", label: "Today", from: todayISO(), to: todayISO() },
    { key: "yesterday", label: "Yesterday", from: shiftISO(-1), to: shiftISO(-1) },
    { key: "week", label: "This week", from: startOfWeekISO(), to: todayISO() },
    { key: "month", label: "This month", from: startOfMonthISO(), to: todayISO() },
  ];
  const active = presets.find((p) => p.from === from && p.to === to)?.key ?? "custom";
  const DATE = "h-9 rounded-xl border border-line bg-surface px-2.5 text-[13px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Segmented label="Period" value={active}
        onChange={(k) => { const p = presets.find((x) => x.key === k); if (p) { setFrom(p.from); setTo(p.to); } }}
        options={[...presets.map((p) => ({ key: p.key, label: p.label })), { key: "custom", label: "Custom" }]} />
      <div className="flex items-center gap-1.5">
        <CalendarDays className="size-4 text-ink-4" />
        <input type="date" aria-label="From" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={DATE} />
        <span className="text-xs text-ink-4">to</span>
        <input type="date" aria-label="To" value={to} min={from} max={todayISO()} onChange={(e) => e.target.value && setTo(e.target.value)} className={DATE} />
      </div>
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div className="flex min-h-[320px] items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-8">
      <Loader2 className="size-4 animate-spin text-brand" />
      <span className="text-sm text-ink-3">Compiling figures…</span>
    </div>
  );
}

function SentList({ reports, emptyText, onOpen, showAuthor }: {
  reports: SentReport[]; emptyText: string; onOpen?: (r: SentReport) => void; showAuthor?: boolean;
}) {
  const paging = usePagination(reports, 8);
  return (
    <section className="no-print overflow-hidden rounded-2xl border border-line bg-surface">
      <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 font-display text-[15px] font-extrabold text-ink">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><Inbox className="size-4" /></span>
        {showAuthor ? "Reports received" : "Reports you've sent"}
        <span className="num font-sans text-sm font-normal text-ink-4">{reports.length}</span>
      </h2>
      {reports.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here yet" description={emptyText} />
      ) : (
        <ul className="divide-y divide-line">
          {paging.pageItems.map((r) => {
            const unread = r.status !== "read";
            const row = (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${unread && showAuthor ? "bg-brand-soft text-brand" : "bg-recess text-ink-3"}`}>
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14px] text-ink ${unread && showAuthor ? "font-bold" : "font-semibold"}`}>{r.title}</p>
                  <p className="truncate text-[12px] text-ink-4">
                    {showAuthor && <>{r.author.username} · </>}
                    {new Date(r.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                    {" · "}{r.totalTransactions} sale{r.totalTransactions === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="num shrink-0 font-display text-[15px] font-extrabold text-ink">
                  ₱{r.totalSales.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${r.status === "read" ? "bg-good-soft text-good" : "bg-brand-soft text-brand-ink"}`}>
                  {r.status === "read" ? "Read" : showAuthor ? "New" : "Sent"}
                </span>
              </div>
            );
            return (
              <li key={r.id}>
                {onOpen ? (
                  <button type="button" onClick={() => onOpen(r)} className="w-full text-left transition hover:bg-subtle">{row}</button>
                ) : row}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination {...paging} onChange={paging.setPage} noun="reports" />
    </section>
  );
}
