import dynamic from 'next/dynamic';

const NavigationMap = dynamic(() => import('./NavigationMapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-ink-3">Loading map…</div>
  ),
});

export default NavigationMap;
