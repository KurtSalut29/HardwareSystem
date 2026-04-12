'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import Link from 'next/link';
import { useEffect, useState } from 'react';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const storeIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C8.268 0 0 6.268 0 16c0 10.667 16 24 16 24S32 26.667 32 16C32 6.268 23.732 0 16 0z"
      fill="#1e293b" stroke="white" stroke-width="2"/>
    <text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">🏪</text>
  </svg>`,
  className: '',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

export const STATUS_COLORS: Record<string, string> = {
  delivered: '#16a34a',
  pending:   '#ea580c',
  confirmed: '#2563eb',
  cancelled: '#dc2626',
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

export type OrderPin = {
  id: number;
  status: string;
  deliveryAddress: string | null;
  latitude: number;
  longitude: number;
  customerUsername?: string;
  distanceLabel?: string;
  durationLabel?: string;
};

type OrderMapProps = {
  pins: OrderPin[];
  loading?: boolean;
  height?: string;
  linkToOrders?: boolean;
  storeLat?: number;
  storeLng?: number;
  storeName?: string;
};

const BILIRAN_CENTER: [number, number] = [11.5833, 124.3667];
const BILIRAN_ZOOM = 11;
const BILIRAN_BOUNDS: [[number, number], [number, number]] = [
  [11.42, 124.25],
  [11.75, 124.55],
];

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
  storeLat, storeLng, storeName = 'Hardware Store'
}: OrderMapProps) {
  // Road routes keyed by pin id — only for non-delivered orders
  const [routes, setRoutes] = useState<Record<number, [number, number][]>>({});

  useEffect(() => {
    if (!storeLat || !storeLng) return;
    const activePins = pins.filter((p) => p.status !== 'delivered' && p.status !== 'cancelled');

    // Remove routes for pins that are now delivered/cancelled
    setRoutes((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        const pin = pins.find((p) => p.id === Number(id));
        if (!pin || pin.status === 'delivered' || pin.status === 'cancelled') {
          delete updated[Number(id)];
        }
      });
      return updated;
    });

    if (activePins.length === 0) return;

    let cancelled = false;
    async function loadRoutes() {
      const results: Record<number, [number, number][]> = {};
      for (const pin of activePins) {
        if (cancelled) break;
        // Skip if we already have this route cached
        if (routes[pin.id]) continue;
        const route = await fetchRoute(storeLat!, storeLng!, pin.latitude, pin.longitude);
        results[pin.id] = route;
      }
      if (!cancelled && Object.keys(results).length > 0) {
        setRoutes((prev) => ({ ...prev, ...results }));
      }
    }
    loadRoutes();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, storeLat, storeLng]);

  if (loading) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-sm">
        <span className="animate-pulse">Loading map…</span>
      </div>
    );
  }

  const center = computeCenter(pins);
  const zoom = pins.length === 1 ? 13 : BILIRAN_ZOOM;

  const mapContent = (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {storeLat && storeLng && (
        <Marker position={[storeLat, storeLng]} icon={storeIcon}>
          <Popup><div className="text-sm font-semibold">🏪 {storeName}</div></Popup>
        </Marker>
      )}
      {/* Road routes — only for pending/confirmed orders */}
      {Object.entries(routes).map(([id, coords]) => {
        const pin = pins.find((p) => p.id === Number(id));
        if (!pin) return null;
        return (
          <Polyline
            key={`route-${id}`}
            positions={coords}
            pathOptions={{
              color: STATUS_COLORS[pin.status] ?? STATUS_COLORS.confirmed,
              weight: 3,
              opacity: 0.8,
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
                <span className="capitalize">{pin.status}</span>
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
          maxBounds={BILIRAN_BOUNDS}
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
        key="biliran-pins"
        center={center}
        zoom={zoom}
        minZoom={10}
        maxZoom={18}
        maxBounds={BILIRAN_BOUNDS}
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
