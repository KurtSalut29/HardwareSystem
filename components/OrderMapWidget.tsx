'use client';

import { useEffect, useState } from 'react';
import OrderMap, { OrderPin } from './OrderMap';

export default function OrderMapWidget({ compact = false }: { compact?: boolean }) {
  const [pins, setPins] = useState<OrderPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function load() {
      fetch('/api/orders/locations')
        .then((res) => res.json())
        .then((data) => {
          setPins(data);
          setLoading(false);
        })
        .catch(() => {
          setPins([]);
          setLoading(false);
        });
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = pins.filter((p) => p.status === 'out_for_delivery').length;

  return (
    <div style={{ isolation: 'isolate' }} className={`bg-white rounded-xl border border-gray-200 ${compact ? 'p-4' : 'p-5'}`}>
      <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-2.5' : 'mb-3'}`}>
        <div className="min-w-0">
          <h2 className={`font-display font-extrabold text-gray-900 ${compact ? 'text-sm' : ''}`}>Live Deliveries</h2>
          {!compact && <p className="text-xs text-gray-400 mt-0.5">Real-time order &amp; driver locations</p>}
        </div>
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--brand)" }} />
            LIVE · {activeCount} out
          </span>
        )}
      </div>
      <OrderMap pins={pins} loading={loading} linkToOrders={true} height={compact ? '200px' : '350px'} />
    </div>
  );
}
