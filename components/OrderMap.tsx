import dynamic from 'next/dynamic';

export type { OrderPin } from './OrderMapInner';

const OrderMap = dynamic(() => import('./OrderMapInner'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-sm text-gray-500">Loading map...</div>,
});

export default OrderMap;
