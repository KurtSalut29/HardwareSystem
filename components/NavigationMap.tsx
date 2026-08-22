import dynamic from 'next/dynamic';

const NavigationMap = dynamic(() => import('./NavigationMapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-gray-500">Loading map…</div>
  ),
});

export default NavigationMap;
