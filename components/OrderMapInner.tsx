'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BILIRAN_CENTER, BILIRAN_LEAFLET_BOUNDS } from '@/lib/biliran';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const storeIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C8.268 0 0 6.268 0 16c0 10.667 16 24 16 24S32 26.667 32 16C32 6.268 23.732 0 16 0z"
      fill="#1E4FD8" stroke="white" stroke-width="2"/>
    <text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">🏪</text>
  </svg>`,
  className: '',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

// Kept in sync with the semantic status tokens in globals.css (--good/--warn/--info/--bad)
// and Badge.tsx, so a pin on the map always matches its badge color elsewhere in the app.
export const STATUS_COLORS: Record<string, string> = {
  delivered: '#128A4A',
  pending:   '#B4670A',
  confirmed: '#2D6FE0',
  out_for_delivery: '#12327F',
  cancelled: '#D1362A',
};

function createPinIcon(status: string) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.confirmed;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
      fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36] });
}

const driverIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <circle cx="15" cy="15" r="13" fill="none" stroke="#1E4FD8" stroke-width="2" opacity="0.5">
      <animate attributeName="r" values="13;16;13" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0;0.5" dur="1.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="15" cy="15" r="14" fill="#1E4FD8" stroke="white" stroke-width="2"/>
    <text x="15" y="20" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">🛵</text>
  </svg>`,
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

function timeAgo(iso?: string | null): string | null {
  if (!iso) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export type OrderPin = {
  id: number;
  status: string;
  deliveryAddress: string | null;
  latitude: number;
  longitude: number;
  customerUsername?: string;
  distanceLabel?: string;
  durationLabel?: string;
  driverId?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  driverLocationUpdatedAt?: string | null;
  driver?: { username: string } | null;
};

type OrderMapProps = {
  pins: OrderPin[];
  loading?: boolean;
  height?: string;
  linkToOrders?: boolean;
  storeLat?: number;
  storeLng?: number;
  storeName?: string;
  /** Where each route line starts. 'store' is the dispatch view; 'driver' draws
   *  from the driver's own live position, which is what they need while driving. */
  routeFrom?: 'store' | 'driver';
};

const BILIRAN_ZOOM = 11;

function computeCenter(pins: OrderPin[]): [number, number] {
  if (pins.length === 0) return BILIRAN_CENTER;
  const lat = pins.reduce((sum, p) => sum + p.latitude, 0) / pins.length;
  const lng = pins.reduce((sum, p) => sum + p.longitude, 0) / pins.length;
  return [lat, lng];
}

// Fetch road route from OSRM (free, no API key)
async function fetchRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) return [[fromLat, fromLng], [toLat, toLng]];
    // GeoJSON coords are [lng, lat] — flip to [lat, lng] for Leaflet
    return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
  } catch {
    return [[fromLat, fromLng], [toLat, toLng]];
  }
}

export default function OrderMapInner({
  pins, loading, height = '350px', linkToOrders,
  storeLat, storeLng, storeName = 'Hardware Store', routeFrom = 'store'
}: OrderMapProps) {
  // Road routes keyed by pin id. `key` records which origin the line was drawn
  // from, so a driver route is refetched once they've actually moved.
  const [routes, setRoutes] = useState<Record<number, { key: string; coords: [number, number][] }>>({});

  useEffect(() => {
    const activePins = pins.filter((p) => p.status !== 'delivered' && p.status !== 'cancelled');

    // Origin for a given pin: the driver's live position, or the store.
    const originFor = (pin: OrderPin): { lat: number; lng: number } | null => {
      if (routeFrom === 'driver') {
        return pin.driverLat != null && pin.driverLng != null
          ? { lat: pin.driverLat, lng: pin.driverLng }
          : null;
      }
      return storeLat != null && storeLng != null ? { lat: storeLat, lng: storeLng } : null;
    };

    // ~3 decimals ≈ 100m, so GPS jitter doesn't re-request a route every ping.
    const originKey = (o: { lat: number; lng: number }) => `${o.lat.toFixed(3)},${o.lng.toFixed(3)}`;

    // Drop routes whose order is finished or no longer on the map
    setRoutes((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        const pin = pins.find((p) => p.id === Number(id));
        if (!pin || pin.status === 'delivered' || pin.status === 'cancelled') delete updated[Number(id)];
      });
      return updated;
    });

    if (activePins.length === 0) return;

    let cancelled = false;
    async function loadRoutes() {
      const results: Record<number, { key: string; coords: [number, number][] }> = {};
      for (const pin of activePins) {
        if (cancelled) break;
        const origin = originFor(pin);
        if (!origin) continue;
        const key = originKey(origin);
        // Already drawn from (approximately) this same origin
        if (routes[pin.id]?.key === key) continue;
        const coords = await fetchRoute(origin.lat, origin.lng, pin.latitude, pin.longitude);
        results[pin.id] = { key, coords };
      }
      if (!cancelled && Object.keys(results).length > 0) {
        setRoutes((prev) => ({ ...prev, ...results }));
      }
    }
    loadRoutes();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, storeLat, storeLng, routeFrom]);

  if (loading) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-sm">
        <span className="animate-pulse">Loading map…</span>
      </div>
    );
  }

  const center = computeCenter(pins);
  const zoom = pins.length === 1 ? 13 : BILIRAN_ZOOM;

  // On the driver's map, frame the whole route — otherwise their position and the
  // drop-off can sit on top of each other and the line is invisible.
  const driverPoints: [number, number][] = routeFrom === 'driver'
    ? pins.filter((p) => p.driverLat != null && p.driverLng != null).map((p) => [p.driverLat!, p.driverLng!])
    : [];
  const fitPoints: [number, number][] = [
    ...pins.map((p) => [p.latitude, p.longitude] as [number, number]),
    ...driverPoints,
  ];
  // Fit whatever we're showing rather than trusting a fixed zoom — the service
  // area spans the whole province, so a static zoom leaves mostly open water.
  const fitBounds = fitPoints.length > 1
    ? L.latLngBounds(fitPoints).pad(driverPoints.length > 0 ? 0.25 : 0.15)
    : null;

  const mapContent = (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        subdomains="abc"
        maxZoom={19}
      />
      {storeLat && storeLng && (
        <Marker position={[storeLat, storeLng]} icon={storeIcon}>
          <Popup><div className="text-sm font-semibold">🏪 {storeName}</div></Popup>
        </Marker>
      )}
      {/* Road routes — from the store, or from the driver on their own map */}
      {Object.entries(routes).map(([id, route]) => {
        const pin = pins.find((p) => p.id === Number(id));
        if (!pin) return null;
        return (
          <Polyline
            key={`route-${id}`}
            positions={route.coords}
            pathOptions={{
              color: STATUS_COLORS[pin.status] ?? STATUS_COLORS.confirmed,
              weight: routeFrom === 'driver' ? 5 : 3,
              opacity: 0.85,
            }}
          />
        );
      })}
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.latitude, pin.longitude]} icon={createPinIcon(pin.status)}>
          <Popup>
            <div className="text-sm space-y-1 min-w-[160px]">
              <p><strong>Order #{pin.id}</strong></p>
              <p className="flex items-center gap-1">
                <span style={{ background: STATUS_COLORS[pin.status] ?? STATUS_COLORS.confirmed }}
                  className="inline-block w-2 h-2 rounded-full shrink-0" />
                <span className="capitalize">{pin.status.replace(/_/g, ' ')}</span>
              </p>
              {pin.deliveryAddress && <p className="text-xs text-gray-500">📍 {pin.deliveryAddress}</p>}
              {pin.customerUsername && <p className="text-xs text-gray-500">👤 {pin.customerUsername}</p>}
              {pin.distanceLabel && (
                <div className="mt-1 pt-1 border-t border-gray-100 text-xs text-gray-600 space-y-0.5">
                  <p>🛣️ {pin.distanceLabel} from store</p>
                  <p>🕐 {pin.durationLabel} travel time</p>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
      {pins
        .filter((p) => p.driverLat != null && p.driverLng != null)
        .map((pin) => (
          <Marker key={`driver-${pin.id}`} position={[pin.driverLat!, pin.driverLng!]} icon={driverIcon}>
            <Popup>
              <div className="text-sm space-y-1 min-w-[140px]">
                <p><strong>🛵 {pin.driver?.username ?? 'Driver'}</strong></p>
                <p className="text-xs text-gray-500">Delivering Order #{pin.id}</p>
                {timeAgo(pin.driverLocationUpdatedAt) && (
                  <p className="text-xs text-gray-400">Updated {timeAgo(pin.driverLocationUpdatedAt)}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
    </>
  );

  if (pins.length === 0) {
    return (
      <div>
        <MapContainer
          key="biliran-empty"
          center={BILIRAN_CENTER}
          zoom={BILIRAN_ZOOM}
          minZoom={10}
          maxZoom={18}
          maxBounds={BILIRAN_LEAFLET_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ height, width: '100%', borderRadius: '0.5rem' }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          {mapContent}
        </MapContainer>
        <p className="text-center text-xs text-gray-400 mt-2">No delivery locations available.</p>
        {linkToOrders && (
          <div className="mt-1 text-right">
            <Link href="/orders" className="text-sm text-blue-600 hover:underline">View all orders →</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <MapContainer
        // Remount when the set being framed changes, so the fit is recomputed.
        key={fitBounds ? `fit-${routeFrom}-${fitPoints.length}` : 'biliran-pins'}
        {...(fitBounds ? { bounds: fitBounds } : { center, zoom })}
        minZoom={10}
        maxZoom={18}
        maxBounds={BILIRAN_LEAFLET_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height, width: '100%', borderRadius: '0.5rem' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        {mapContent}
      </MapContainer>
      {linkToOrders && (
        <div className="mt-2 text-right">
          <Link href="/orders" className="text-sm text-blue-600 hover:underline">View all orders →</Link>
        </div>
      )}
    </div>
  );
}
