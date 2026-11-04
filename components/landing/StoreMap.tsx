import dynamic from 'next/dynamic';

// Leaflet touches `window` on import, so the map only ever renders in the browser.
const StoreMap = dynamic(() => import('./StoreMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse" style={{ background: 'var(--bg-muted)' }} />,
});

export default StoreMap;
