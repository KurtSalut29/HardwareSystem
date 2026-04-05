"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Package } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Image from "next/image";

type TItem = { id: number; quantity: number; price: number; product: { name: string; image: string | null; subcategory: string | null } };
type Transaction = { id: number; totalAmount: number; paymentMethod: string; dateTime: string; type: string; user: { username: string }; items: TItem[] };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(toDateKey(today));

  useEffect(() => {
    fetch("/api/transactions").then((r) => r.json()).then((d) => { setTransactions(d); setLoading(false); });
  }, []);

  // Build a set of date keys that have transactions
  const txDateKeys = new Set(transactions.map((t) => toDateKey(new Date(t.dateTime))));

  // Transactions for selected date
  const selectedTxns = transactions.filter((t) => toDateKey(new Date(t.dateTime)) === selectedKey);

  // Selected date label
  function selectedLabel() {
    const [y, m, d] = selectedKey.split("-").map(Number);
    const date = new Date(y, m, d);
    if (toDateKey(date) === toDateKey(today)) return "Today";
    return date.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  // Calendar grid
  function buildCalendar() {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  }

  const cells = buildCalendar();

  return (
    <div className="space-y-5">
      <PageHeader title="Transactions" subtitle="All POS transaction records" />

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* Calendar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 w-full lg:w-72 lg:shrink-0">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-semibold text-gray-900">{MONTHS[calMonth]} {calYear}</span>
              <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const key = `${calYear}-${calMonth}-${day}`;
                const isToday = toDateKey(today) === key;
                const isSelected = selectedKey === key;
                const hasTxns = txDateKeys.has(key);
                return (
                  <button key={i} onClick={() => setSelectedKey(key)}
                    className={`relative w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition
                      ${isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-700 hover:bg-gray-100"}`}>
                    {day}
                    {hasTxns && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                    )}
                    {hasTxns && isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/60" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Transactions</span>
                <span className="font-semibold text-gray-900">{selectedTxns.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Sales</span>
                <span className="font-semibold text-blue-600">₱{selectedTxns.reduce((s, t) => s + t.totalAmount, 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Transactions for selected date */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="font-semibold text-gray-900 text-sm">{selectedLabel()}</span>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{selectedTxns.length} transactions</span>
              {selectedTxns.length > 0 && (
                <span className="ml-auto text-xs font-semibold text-gray-700">
                  Total: ₱{selectedTxns.reduce((s, t) => s + t.totalAmount, 0).toFixed(2)}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide w-8"></th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">ID</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Cashier</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Type</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Payment</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selectedTxns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-gray-400 text-sm">
                        No transactions on this date.
                      </td>
                    </tr>
                  ) : selectedTxns.map((t) => (
                    <React.Fragment key={t.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                        <td className="py-3 px-4 text-gray-400">
                          {expanded === t.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">#{t.id}</td>
                        <td className="py-3 px-4 text-gray-600 hidden sm:table-cell">{t.user.username}</td>
                        <td className="py-3 px-4 hidden sm:table-cell"><Badge label={t.type} /></td>
                        <td className="py-3 px-4 text-gray-500">{t.paymentMethod}</td>
                        <td className="py-3 px-4 font-semibold text-gray-900">₱{t.totalAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs hidden sm:table-cell">{new Date(t.dateTime).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</td>
                      </tr>
                      {expanded === t.id && (
                        <tr className="bg-blue-50/30">
                          <td colSpan={7} className="px-6 py-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Items Purchased</p>
                            <div className="flex flex-col gap-2">
                              {t.items.map((i) => (
                                <div key={i.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                                  <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                    {i.product.image ? (
                                      <Image src={i.product.image} alt={i.product.name} width={40} height={40} className="w-full h-full object-cover" />
                                    ) : (
                                      <Package size={16} className="text-gray-300" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{i.product.name}</p>
                                    {i.product.subcategory && <p className="text-[11px] text-blue-500">{i.product.subcategory}</p>}
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs text-gray-400">₱{i.price.toFixed(2)} × {i.quantity}</p>
                                    <p className="text-sm font-semibold text-gray-900">₱{(i.price * i.quantity).toFixed(2)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                              <span className="text-xs text-gray-500 mr-2">Total</span>
                              <span className="text-sm font-bold text-gray-900">₱{t.totalAmount.toFixed(2)}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
