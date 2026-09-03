"use client";

import { STORE_NAME } from "@/lib/brand";

export type SheetSummary = {
  totalSales: number;
  totalTransactions: number;
  itemsSold: number;
  cashTotal: number;
  gcashTotal: number;
  otherTotal: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  lines: { id: number; dateTime: string; totalAmount: number; paymentMethod: string; itemCount: number; staff: string }[];
  orders: { placed: number; placedValue: number; delivered: number; cancelled: number; outstandingBalance: number };
};

const peso = (n: number) => `₱${n.toFixed(2)}`;

/**
 * The printable document itself.
 *
 * `data-print-root` is what the print stylesheet keys off — everything outside
 * this element is hidden when the page is sent to a printer, so the same markup
 * serves as both the on-screen preview and the paper copy.
 */
export default function ReportSheet({
  title,
  periodLabel,
  preparedBy,
  scopeLabel,
  summary,
  note,
  generatedAt,
}: {
  title: string;
  periodLabel: string;
  preparedBy: string;
  scopeLabel: string;
  summary: SheetSummary;
  note?: string | null;
  generatedAt?: string;
}) {
  const stamp = generatedAt ? new Date(generatedAt) : new Date();

  return (
    <div
      data-print-root
      className="bg-white rounded-2xl border p-6 sm:p-8 text-[13px]"
      style={{ borderColor: "var(--border-strong)", color: "#14161F" }}
    >
      {/* Letterhead */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b-2" style={{ borderColor: "#14161F" }}>
        <div>
          <p className="font-display text-xl font-extrabold tracking-tight">{STORE_NAME}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#6B7086" }}>Naval, Biliran &middot; Hardware Store Management System</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6B7086" }}>{scopeLabel}</p>
          <p className="font-display text-sm font-extrabold mt-0.5">{title}</p>
        </div>
      </div>

      {/* Meta block */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 py-4 border-b" style={{ borderColor: "#E2E5F0" }}>
        <Meta label="Period covered" value={periodLabel} />
        <Meta label="Prepared by" value={preparedBy} />
        <Meta label="Generated" value={stamp.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })} />
        <Meta label="Transactions" value={String(summary.totalTransactions)} />
      </dl>

      {/* Headline figures. "Other" only appears when there is something in it —
          it covers counter payments taken by any other method (card, etc.) and
          is shown so Cash + GCash + Other always reconciles to Total sales. */}
      <div className={`grid grid-cols-2 gap-3 py-5 ${summary.otherTotal > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        <Figure label="Total sales" value={peso(summary.totalSales)} emphasis />
        <Figure label="Cash" value={peso(summary.cashTotal)} />
        <Figure label="GCash" value={peso(summary.gcashTotal)} />
        {summary.otherTotal > 0 && <Figure label="Other" value={peso(summary.otherTotal)} />}
        <Figure label="Items sold" value={String(summary.itemsSold)} />
      </div>

      {/* Online-order activity */}
      <Section title="Online order activity">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Orders placed" value={String(summary.orders.placed)} />
          <MiniStat label="Order value" value={peso(summary.orders.placedValue)} />
          <MiniStat label="Delivered" value={String(summary.orders.delivered)} />
          <MiniStat label="Unpaid balance" value={peso(summary.orders.outstandingBalance)} />
        </div>
        <p className="text-[10px] mt-2" style={{ color: "#6B7086" }}>
          Online orders are counted as sales only once they are rung up at the counter, so they are listed
          separately here and are not added to Total sales above.
        </p>
      </Section>

      {/* Top products */}
      <Section title="Top products">
        {summary.topProducts.length === 0 ? (
          <Empty>No products were sold in this period.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide" style={{ color: "#6B7086" }}>
                <Th className="text-left">Product</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody>
              {summary.topProducts.map((p) => (
                <tr key={p.name} style={{ borderTop: "1px solid #E2E5F0" }}>
                  <Td className="text-left font-medium">{p.name}</Td>
                  <Td className="text-right num">{p.quantity}</Td>
                  <Td className="text-right num font-semibold">{peso(p.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Transaction detail */}
      <Section title={`Transactions (${summary.lines.length})`}>
        {summary.lines.length === 0 ? (
          <Empty>No transactions were recorded in this period.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide" style={{ color: "#6B7086" }}>
                <Th className="text-left">Ref</Th>
                <Th className="text-left">Date &amp; time</Th>
                <Th className="text-left">Handled by</Th>
                <Th className="text-left">Payment</Th>
                <Th className="text-right">Items</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {summary.lines.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid #E2E5F0" }}>
                  <Td className="text-left num">#{l.id}</Td>
                  <Td className="text-left">{new Date(l.dateTime).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short" })}</Td>
                  <Td className="text-left">{l.staff}</Td>
                  <Td className="text-left">{l.paymentMethod}</Td>
                  <Td className="text-right num">{l.itemCount}</Td>
                  <Td className="text-right num font-semibold">{peso(l.totalAmount)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #14161F" }}>
                <Td className="text-left font-bold" colSpan={5}>Total</Td>
                <Td className="text-right num font-extrabold">{peso(summary.totalSales)}</Td>
              </tr>
            </tfoot>
          </table>
        )}
      </Section>

      {note && (
        <Section title="Remarks">
          <p className="whitespace-pre-wrap leading-relaxed">{note}</p>
        </Section>
      )}

      {/* Signature block — the sheet is submitted to the admin on paper too. */}
      <div className="grid grid-cols-2 gap-8 pt-10 avoid-break">
        <Signature label="Prepared by" name={preparedBy} />
        <Signature label="Received / noted by" name="" />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6B7086" }}>{label}</dt>
      <dd className="text-[13px] font-semibold mt-0.5">{value}</dd>
    </div>
  );
}

function Figure({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className="rounded-xl px-3.5 py-3 avoid-break"
      style={{
        border: `1px solid ${emphasis ? "#14161F" : "#E2E5F0"}`,
        background: emphasis ? "#F5F6FB" : "transparent",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6B7086" }}>{label}</p>
      <p className={`font-display num mt-1 ${emphasis ? "text-2xl font-extrabold" : "text-lg font-bold"}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="avoid-break">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6B7086" }}>{label}</p>
      <p className="font-display text-base font-extrabold num mt-0.5">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-5 border-t" style={{ borderColor: "#E2E5F0" }}>
      <h3 className="font-display text-[11px] font-extrabold uppercase tracking-widest mb-3" style={{ color: "#4B4F63" }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-1.5 font-bold ${className}`}>{children}</th>;
}

function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`py-1.5 ${className}`}>{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] italic" style={{ color: "#9498AC" }}>{children}</p>;
}

function Signature({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <div className="h-10" />
      <div style={{ borderTop: "1px solid #14161F" }} className="pt-1.5">
        <p className="text-[12px] font-bold uppercase tracking-wide">{name || " "}</p>
        <p className="text-[10px]" style={{ color: "#6B7086" }}>{label}</p>
      </div>
    </div>
  );
}
