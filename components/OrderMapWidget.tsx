'use client';

import { useEffect, useState } from 'react';
import OrderMap, { OrderPin } from './OrderMap';
import { Store, Truck, MapPin } from 'lucide-react';
import { STATUS_COLORS } from '@/lib/orderStatus';

/** What each marker on the map means. Colors follow the order status, same as the status badges:
 *  orders still in progress are pins, finished ones (delivered, cancelled) are small dots. */
const LEGEND: { label: string; color?: string; icon?: typeof Store; shape?: 'pin' | 'dot' }[] = [
  { label: 'Store', icon: Store },
  { label: 'Driver', icon: Truck },
  { label: 'Pending', color: STATUS_COLORS.pending, shape: 'pin' },
  { label: 'Confirmed', color: STATUS_COLORS.confirmed, shape: 'pin' },
  { label: 'Out for delivery', color: STATUS_COLORS.out_for_delivery, shape: 'pin' },
  { label: 'Delivered', color: STATUS_COLORS.delivered, shape: 'dot' },
  { label: 'Cancelled', color: STATUS_COLORS.cancelled, shape: 'dot' },
];

export function MapLegend({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${compact ? 'mt-2' : 'mt-3'}`} aria-label="Map legend">
      {LEGEND.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
          {item.icon ? (
            <span aria-hidden className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white" style={{ background: '#1E4FD8' }}>
              <item.icon size={10} strokeWidth={2.4} />
            </span>
          ) : item.shape === 'pin' ? (
            <MapPin aria-hidden size={14} strokeWidth={2} style={{ color: 'white', fill: item.color }} className="drop-shadow-[0_0_0.5px_rgba(0,0,0,0.5)]" />
          ) : (
            <span aria-hidden className="w-2.5 h-2.5 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" style={{ background: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export default function OrderMapWidget({
  compact = false,
  title = 'Live Deliveries',
  description = 'Where every active order is going and where each driver is right now. Updates every 15 seconds; click a pin for the order.',
}: {
  compact?: boolean;
  title?: string;
  description?: string;
}) {
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
      <div className={`flex items-start justify-between gap-2 ${compact ? 'mb-2.5' : 'mb-3'}`}>
        <div className="min-w-0">
          <h3 className={`font-display font-extrabold text-gray-900 ${compact ? 'text-sm' : ''}`}>{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
        </div>
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }} title="Orders out for delivery right now">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--brand)" }} />
            LIVE · {activeCount} out
          </span>
        )}
      </div>
      <OrderMap pins={pins} loading={loading} linkToOrders={true} height={compact ? '200px' : '350px'} />
      <MapLegend compact={compact} />
    </div>
  );
}
