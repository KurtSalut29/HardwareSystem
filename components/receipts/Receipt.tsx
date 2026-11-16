"use client";

import Image from "next/image";
import { Printer, Receipt } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { STORE_ADDRESS, STORE_NAME, STORE_TAGLINE } from "@/lib/brand";

/**
 * One receipt layout for every sale: online and phone orders, walk-in orders,
 * and POS checkouts. The same data renders on screen as a paper slip and as a
 * printable 80mm-wide page. It is an acknowledgement receipt, so both versions
 * say plainly that it is not an official receipt.
 */
export type ReceiptData = {
  /** e.g. "Order #1033" or "Sale #5120". */
  number: string;
  date: string | Date;
  customer?: string | null;
  contact?: string | null;
  address?: string | null;
  fulfillment?: "Delivery" | "Pickup" | "Walk-in" | null;
  servedBy?: string | null;
  /** The driver who took (or is taking) a delivery. */
  driver?: string | null;
  /** When the order was delivered or picked up. */
  completedAt?: string | Date | null;
  items: { name: string; quantity: number; unit?: string; price: number }[];
  /** Shown on every delivery receipt ("Free" when zero). */
  deliveryFee?: number;
  /** Why the admin changed this order's delivery fee. */
  deliveryFeeNote?: string | null;
  total: number;
  /** How the customer pays: method, GCash number and reference, verification. */
  payment: { label: string; value: string; tone?: "good" | "warn" }[];
  /** What has been paid so far; the balance is worked out from the total. */
  amountPaid?: number | null;
  /** e.g. "Balance on delivery". Defaults to "Balance due". */
  balanceLabel?: string;
  status?: string | null;
  /** Extra lines, e.g. "Includes online Order #1031". */
  notes?: string[];
};

const NOT_OR = "Not an official receipt";
const NOT_OR_NOTE = "This document is not valid for claim of input tax.";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => String(Math.round(n * 100) / 100);
const when = (d: string | Date) => new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function subtotalOf(r: ReceiptData) {
  return r.items.reduce((s, i) => s + i.price * i.quantity, 0);
}

/** Everything the receipt states, in order, shared by the screen and the printout. */
function linesOf(r: ReceiptData) {
  const isDelivery = r.fulfillment === "Delivery";
  const fee = r.deliveryFee ?? 0;
  const meta: [string, string][] = [["Date", when(r.date)]];
  if (r.customer) meta.push(["Customer", r.customer]);
  if (r.contact) meta.push(["Contact", r.contact]);
  if (r.fulfillment) meta.push(["Type", r.fulfillment]);
  if (r.address) meta.push(["Deliver to", r.address]);
  if (r.driver) meta.push(["Driver", r.driver]);
  if (r.servedBy) meta.push(["Served by", r.servedBy]);
  if (r.status) meta.push(["Status", r.status]);
  if (r.completedAt) meta.push([r.fulfillment === "Pickup" ? "Picked up" : r.fulfillment === "Delivery" ? "Delivered" : "Completed", when(r.completedAt)]);

  const count = r.items.length;
  const totals: [string, string][] = [[`Subtotal (${count} ${count === 1 ? "item" : "items"})`, peso(subtotalOf(r))]];
  if (isDelivery || fee > 0) totals.push(["Delivery fee", fee > 0 ? peso(fee) : "Free"]);

  let paid: { paid: string; balance: string; balanceLabel: string; due: boolean } | null = null;
  if (r.amountPaid != null) {
    const bal = Math.max(0, Math.round((r.total - r.amountPaid) * 100) / 100);
    paid = { paid: peso(Math.min(r.amountPaid, r.total)), balance: bal > 0.005 ? peso(bal) : "Paid in full", balanceLabel: bal > 0.005 ? r.balanceLabel ?? "Balance due" : "Balance", due: bal > 0.005 };
  }
  return { meta, totals, paid };
}

// The slip is paper: white with dark ink in both themes, so what is on screen is what prints.
const TONE = { good: "text-emerald-700", warn: "text-amber-700" } as const;

function Row({ k, v, tone, strong }: { k: string; v: string; tone?: "good" | "warn"; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-[12px] leading-5">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className={`text-right ${strong ? "font-bold" : "font-semibold"} ${tone ? TONE[tone] : "text-slate-900"}`}>{v}</span>
    </div>
  );
}

function Perforation() {
  return <div className="my-4 border-t-2 border-dotted border-slate-200" />;
}

/** Torn-paper edge along the bottom of the slip. */
function TornEdge() {
  const teeth = 24;
  const w = 120 / teeth;
  const d = `M0 0 ${Array.from({ length: teeth }, (_, i) => `L${(i * w + w / 2).toFixed(2)} 7 L${((i + 1) * w).toFixed(2)} 0`).join(" ")} Z`;
  return (
    <svg aria-hidden viewBox="0 0 120 7" preserveAspectRatio="none" className="block h-2.5 w-full text-white drop-shadow-[0_1px_0_rgba(15,23,42,0.08)]">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

export function ReceiptBody({ data }: { data: ReceiptData }) {
  const { meta, totals, paid } = linesOf(data);

  return (
    <div className="rounded-2xl bg-recess p-3 sm:p-4">
      <article className="relative overflow-hidden rounded-t-lg bg-[#fff] px-5 pb-5 pt-6 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        {/* Watermark: readable on every part of the slip, faint enough not to fight the numbers */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-around overflow-hidden select-none">
          {[0, 1, 2].map((i) => (
            <span key={i} className="-rotate-[28deg] whitespace-nowrap font-display text-[26px] font-extrabold uppercase tracking-[0.08em] text-red-600/[0.06]">
              {NOT_OR}
            </span>
          ))}
        </div>

        <div className="relative">
          {/* Store */}
          <header className="flex flex-col items-center text-center">
            <Image src="/logo.png" alt="" width={64} height={64} className="size-16 object-contain" />
            <h2 className="mt-2 font-display text-[21px] font-extrabold leading-none tracking-tight text-slate-900">{STORE_NAME}</h2>
            <p className="mt-1 text-[11px] text-slate-500">{STORE_TAGLINE}</p>
            <p className="text-[11px] text-slate-500">{STORE_ADDRESS}</p>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Acknowledgement receipt</p>
            <p className="mt-1.5 rounded-md border-2 border-red-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-red-600">
              {NOT_OR}
            </p>
          </header>

          <Perforation />

          {/* Who and when */}
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">No.</span>
            <span className="font-code text-[14px] font-bold text-slate-900">{data.number}</span>
          </div>
          <div className="space-y-0.5">
            {meta.map(([k, v]) => <Row key={k} k={k} v={v} />)}
          </div>

          <Perforation />

          {/* Items */}
          <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <span>Item</span><span>Amount</span>
          </div>
          <ul className="space-y-2">
            {data.items.map((i, n) => (
              <li key={n} className="text-[12.5px]">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-slate-900">{i.name}</span>
                  <span className="num shrink-0 font-semibold text-slate-900">{peso(i.price * i.quantity)}</span>
                </div>
                <p className="num text-[11px] text-slate-500">{qty(i.quantity)}{i.unit ? ` ${i.unit}` : ""} × {peso(i.price)}</p>
              </li>
            ))}
          </ul>

          <Perforation />

          {/* Totals */}
          <div className="mb-2 space-y-0.5">
            {totals.map(([k, v]) => <Row key={k} k={k} v={v} />)}
            {data.deliveryFeeNote && <p className="text-right text-[11px] italic text-slate-500">Fee adjusted: {data.deliveryFeeNote}</p>}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#EEF3FE] px-3 py-2.5">
            <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#1E4FD8]">Total</span>
            <span className="num font-display text-[22px] font-extrabold text-slate-900">{peso(data.total)}</span>
          </div>
          {(data.payment.length > 0 || paid) && (
            <div className="mt-3 space-y-0.5">
              {data.payment.map((p) => <Row key={p.label} k={p.label} v={p.value} tone={p.tone} />)}
              {paid && (
                <>
                  <Row k="Amount paid" v={paid.paid} tone="good" />
                  <Row k={paid.balanceLabel} v={paid.balance} tone={paid.due ? "warn" : "good"} strong />
                </>
              )}
            </div>
          )}
          {data.notes && data.notes.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-[11px] text-slate-500">
              {data.notes.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          )}

          <Perforation />

          <footer className="text-center">
            <p className="text-[12.5px] font-semibold text-slate-700">Thank you for your purchase!</p>
            <div className="mt-3 rounded-lg border border-dashed border-red-300 bg-red-50/70 px-3 py-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-red-700">This is {NOT_OR.toLowerCase()}</p>
              <p className="mt-0.5 text-[10.5px] text-red-700/80">{NOT_OR_NOTE}</p>
            </div>
          </footer>
        </div>
      </article>
      <TornEdge />
    </div>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** The receipt as a standalone printable page (no app styles needed), ~80mm wide. */
export function receiptHtml(data: ReceiptData, origin: string) {
  const row = (k: string, v: string, cls = "") => `<div class="row ${cls}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  const { meta, totals, paid } = linesOf(data);
  const logo = `${origin}/logo.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(data.number)} — ${esc(STORE_NAME)}</title><style>
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#0f172a;max-width:302px;margin:12px auto;padding:0 10px}
    .head{text-align:center}.head img{width:64px;height:64px;object-fit:contain}
    h1{font-size:19px;margin:6px 0 2px;letter-spacing:-.01em}.c{color:#555;font-size:11px;margin:1px 0}
    .kind{margin:12px 0 4px;font-size:9.5px;letter-spacing:.22em;color:#777;font-weight:700}
    .stamp{display:inline-block;border:2px solid #000;border-radius:4px;padding:3px 10px;font-weight:800;font-size:11px;letter-spacing:.14em}
    hr{border:none;border-top:1px dashed #999;margin:12px 0}
    .row{display:flex;justify-content:space-between;gap:12px;margin:3px 0}.k{color:#555;white-space:nowrap}.v{text-align:right;font-weight:600}
    .no .v{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;font-weight:700}
    .cols{display:flex;justify-content:space-between;font-size:9.5px;letter-spacing:.14em;color:#777;font-weight:700;margin-bottom:4px}
    .item{margin:6px 0}.item .v{font-weight:600}.muted{color:#666;font-size:11px;margin:1px 0 0}
    .total{border-top:2px solid #000;border-bottom:2px solid #000;padding:6px 0;margin:8px 0;font-size:16px}.total .k{color:#000;font-weight:800;letter-spacing:.1em}.total .v{font-weight:800}.bal .k,.bal .v{font-weight:800;color:#000}
    .foot{text-align:center}.thanks{font-weight:600;margin:0 0 10px}
    .notor{border:1.5px dashed #000;padding:6px 8px}.notor b{display:block;font-size:11px;letter-spacing:.1em}.notor span{font-size:10.5px;color:#333}
    .notor{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:6mm}
    @media print{body{margin:0 auto}}
  </style></head><body>
    <div class="head">
      <img src="${logo}" alt="">
      <h1>${esc(STORE_NAME)}</h1>
      <p class="c">${esc(STORE_TAGLINE)}</p><p class="c">${esc(STORE_ADDRESS)}</p>
      <p class="kind">ACKNOWLEDGEMENT RECEIPT</p>
      <span class="stamp">NOT AN OFFICIAL RECEIPT</span>
    </div><hr>
    ${row("No.", data.number, "no")}${meta.map(([k, v]) => row(k, v)).join("")}<hr>
    <div class="cols"><span>ITEM</span><span>AMOUNT</span></div>
    ${data.items.map((i) => `<div class="item">${row(i.name, peso(i.price * i.quantity))}<p class="muted">${qty(i.quantity)}${i.unit ? " " + esc(i.unit) : ""} × ${peso(i.price)}</p></div>`).join("")}<hr>
    ${totals.map(([k, v]) => row(k, v)).join("")}
    ${data.deliveryFeeNote ? `<p class="muted" style="text-align:right;font-style:italic">Fee adjusted: ${esc(data.deliveryFeeNote)}</p>` : ""}
    ${row("TOTAL", peso(data.total), "total")}
    ${data.payment.map((p) => row(p.label, p.value)).join("")}
    ${paid ? row("Amount paid", paid.paid) + row(paid.balanceLabel, paid.balance, "bal") : ""}
    ${data.notes?.length ? data.notes.map((n) => `<p class="muted">• ${esc(n)}</p>`).join("") : ""}
    <hr><div class="foot"><p class="thanks">Thank you for your purchase!</p>
    <div class="notor"><b>THIS IS NOT AN OFFICIAL RECEIPT</b><span>${esc(NOT_OR_NOTE)}</span></div></div>
  </body></html>`;
}

/**
 * Prints the receipt from a hidden frame on the same page: no pop-up window for
 * the browser to block, and the logo has loaded before the print dialog opens.
 */
export function printReceipt(data: ReceiptData) {
  document.getElementById("receipt-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "receipt-print-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write(receiptHtml(data, window.location.origin));
  doc.close();

  let printed = false;
  const go = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
  };
  const img = doc.querySelector("img");
  if (img && !img.complete) {
    img.addEventListener("load", go, { once: true });
    img.addEventListener("error", go, { once: true });
    setTimeout(go, 2500); // never wait forever on a slow logo
  } else {
    setTimeout(go, 50);
  }
}

export default function ReceiptModal({ data, onClose, title = "Receipt" }: { data: ReceiptData; onClose: () => void; title?: string }) {
  return (
    <Modal open onClose={onClose} title={title} icon={<Receipt className="size-5" />} description="Print it or save it as a PDF." size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1" onClick={() => printReceipt(data)} icon={<Printer className="size-4" />}>Print receipt</Button>
        </div>
      }>
      <ReceiptBody data={data} />
    </Modal>
  );
}
