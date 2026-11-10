"use client";

import { Printer } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { STORE_ADDRESS, STORE_NAME } from "@/lib/brand";
import { ICON_SIZE } from "@/lib/constants/icon-size";

/**
 * One receipt layout for every sale: online and phone orders, walk-in orders,
 * and POS checkouts. The same data renders on screen and as a printable
 * 80mm-wide slip.
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
  items: { name: string; quantity: number; unit?: string; price: number }[];
  deliveryFee?: number;
  total: number;
  payment: { label: string; value: string; tone?: "good" | "warn" }[];
  status?: string | null;
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => String(Math.round(n * 100) / 100);
const when = (d: string | Date) => new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function subtotalOf(r: ReceiptData) {
  return r.items.reduce((s, i) => s + i.price * i.quantity, 0);
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "good" | "warn" }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-gray-500">{k}</span>
      <span className="text-right font-semibold text-gray-800"
        style={tone ? { color: tone === "good" ? "var(--good)" : "var(--warn)" } : undefined}>{v}</span>
    </div>
  );
}

export function ReceiptBody({ data }: { data: ReceiptData }) {
  const subtotal = subtotalOf(data);
  return (
    <div className="space-y-3.5">
      <div className="text-center">
        <p className="font-bold text-gray-900 text-base">{STORE_NAME}</p>
        <p className="text-[11px] text-gray-400">{STORE_ADDRESS}</p>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Official Receipt</p>
      </div>
      <div className="border-t border-dashed border-gray-200" />
      <div className="space-y-1">
        <Row k="No." v={data.number} />
        <Row k="Date" v={when(data.date)} />
        {data.customer && <Row k="Customer" v={data.customer} />}
        {data.contact && <Row k="Contact" v={data.contact} />}
        {data.fulfillment && <Row k="Type" v={data.fulfillment} />}
        {data.address && <Row k="Deliver to" v={data.address} />}
        {data.servedBy && <Row k="Served by" v={data.servedBy} />}
        {data.status && <Row k="Status" v={data.status} />}
      </div>
      <div className="border-t border-dashed border-gray-200" />
      <div className="space-y-1.5">
        {data.items.map((i, n) => (
          <div key={n} className="text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-gray-800 font-medium">{i.name}</span>
              <span className="font-semibold text-gray-900 num">{peso(i.price * i.quantity)}</span>
            </div>
            <p className="text-[11px] text-gray-400 num">{qty(i.quantity)}{i.unit ? ` ${i.unit}` : ""} × {peso(i.price)}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-gray-200" />
      <div className="space-y-1">
        {!!data.deliveryFee && <Row k="Subtotal" v={peso(subtotal)} />}
        {!!data.deliveryFee && <Row k="Delivery fee" v={peso(data.deliveryFee)} />}
        <div className="flex justify-between items-center pt-0.5">
          <span className="font-bold text-gray-900">Total</span>
          <span className="font-bold text-lg text-gray-900 num">{peso(data.total)}</span>
        </div>
      </div>
      {data.payment.length > 0 && (
        <div className="space-y-1">
          {data.payment.map((p) => <Row key={p.label} k={p.label} v={p.value} tone={p.tone} />)}
        </div>
      )}
      <p className="text-center text-[10px] text-gray-400 pt-1">Thank you for your purchase!</p>
    </div>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Opens the receipt as a plain printable page (no app styles needed) and prints it. */
export function printReceipt(data: ReceiptData) {
  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  const row = (k: string, v: string, cls = "") => `<div class="row ${cls}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  const subtotal = subtotalOf(data);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(data.number)}</title><style>
    body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#111;max-width:300px;margin:12px auto;padding:0 8px}
    h1{font-size:15px;text-align:center;margin:0}.c{text-align:center;color:#555;font-size:11px;margin:2px 0}
    hr{border:none;border-top:1px dashed #999;margin:10px 0}.row{display:flex;justify-content:space-between;gap:10px;margin:3px 0}
    .row span:last-child{text-align:right}.muted{color:#666;font-size:11px;margin:0 0 4px}.total{font-size:15px;font-weight:700}
    @media print{body{margin:0}}
  </style></head><body>
    <h1>${esc(STORE_NAME)}</h1><p class="c">${esc(STORE_ADDRESS)}</p><p class="c">OFFICIAL RECEIPT</p><hr>
    ${row("No.", data.number)}${row("Date", when(data.date))}
    ${data.customer ? row("Customer", data.customer) : ""}${data.contact ? row("Contact", data.contact) : ""}
    ${data.fulfillment ? row("Type", data.fulfillment) : ""}${data.address ? row("Deliver to", data.address) : ""}
    ${data.servedBy ? row("Served by", data.servedBy) : ""}${data.status ? row("Status", data.status) : ""}<hr>
    ${data.items.map((i) => `${row(i.name, peso(i.price * i.quantity))}<p class="muted">${qty(i.quantity)}${i.unit ? " " + esc(i.unit) : ""} × ${peso(i.price)}</p>`).join("")}<hr>
    ${data.deliveryFee ? row("Subtotal", peso(subtotal)) + row("Delivery fee", peso(data.deliveryFee)) : ""}
    ${row("TOTAL", peso(data.total), "total")}
    ${data.payment.map((p) => row(p.label, p.value)).join("")}
    <hr><p class="c">Thank you for your purchase!</p>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export default function ReceiptModal({ data, onClose, title = "Receipt" }: { data: ReceiptData; onClose: () => void; title?: string }) {
  return (
    <Modal open onClose={onClose} title={title} size="sm">
      <ReceiptBody data={data} />
      <Button onClick={() => printReceipt(data)} icon={<Printer size={ICON_SIZE.sm} />} className="w-full mt-4">
        Print Receipt
      </Button>
    </Modal>
  );
}
