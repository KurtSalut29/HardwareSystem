import dynamic from 'next/dynamic';

export type { OrderPin, MapFocus } from './OrderMapInner';

const OrderMap = dynamic(() => import('./OrderMapInner'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-sm text-ink-3">Loading map...</div>,
});

export default OrderMap;
