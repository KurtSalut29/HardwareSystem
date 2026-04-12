'use client';

import { useEffect, useState } from 'react';
import OrderMap, { OrderPin } from './OrderMap';

export default function OrderMapWidget() {
  const [pins, setPins] = useState<OrderPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return (
    <div style={{ isolation: 'isolate', padding: '1rem' }} className="bg-white rounded-xl border border-gray-200">
      <h2 className="text-lg font-semibold mb-3">Order Locations</h2>
      <OrderMap pins={pins} loading={loading} linkToOrders={true} />
    </div>
  );
}
