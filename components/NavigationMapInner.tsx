'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';

const destIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
      fill="#12327F" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>`,
  className: '', iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -38],
});

const meIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 30 30">
    <circle cx="15" cy="15" r="13" fill="none" stroke="#1E4FD8" stroke-width="2" opacity="0.5">
      <animate attributeName="r" values="13;16;13" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0;0.5" dur="1.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="15" cy="15" r="11" fill="#1E4FD8" stroke="white" stroke-width="3"/>
  </svg>`,
  className: '', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17],
});

/** Keeps the driver in view as they move, unless they've panned away themselves. */
function Follow({ lat, lng, enabled }: { lat: number | null; lng: number | null; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || lat == null || lng == null) return;
    map.panTo([lat, lng], { animate: true });
  }, [lat, lng, enabled, map]);
  return null;
}

/** Fits both ends of the trip once, when the route first becomes available. */
function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points).pad(0.2));
    // Intentionally runs only on the first usable route — refitting on every GPS
    // ping would yank the map out from under the driver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length > 1]);
  return null;
}

export type NavigationMapProps = {
  driverLat: number | null;
  driverLng: number | null;
  destLat: number;
  destLng: number;
  destLabel?: string;
  route: [number, number][];
  follow?: boolean;
  height?: string;
};

export default function NavigationMapInner({
  driverLat, driverLng, destLat, destLng, destLabel, route, follow = true, height = '460px',
}: NavigationMapProps) {
  const hasMe = driverLat != null && driverLng != null;
  const fitPoints: [number, number][] = hasMe
    ? [[driverLat!, driverLng!], [destLat, destLng]]
    : [[destLat, destLng]];

  return (
    <MapContainer
      center={hasMe ? [driverLat!, driverLng!] : [destLat, destLng]}
      zoom={15}
      minZoom={9}
      maxZoom={19}
      style={{ height, width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        subdomains="abc"
        maxZoom={19}
      />

      {route.length > 1 && (
        <>
          {/* Casing under the route so it stays readable over busy tiles */}
          <Polyline positions={route} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9 }} />
          <Polyline positions={route} pathOptions={{ color: '#1E4FD8', weight: 6, opacity: 1 }} />
        </>
      )}

      <Marker position={[destLat, destLng]} icon={destIcon}>
        <Popup><div className="text-sm font-semibold">📍 {destLabel ?? 'Drop-off'}</div></Popup>
      </Marker>

      {hasMe && (
        <Marker position={[driverLat!, driverLng!]} icon={meIcon}>
          <Popup><div className="text-sm font-semibold">You are here</div></Popup>
        </Marker>
      )}

      <FitRoute points={fitPoints} />
      <Follow lat={driverLat} lng={driverLng} enabled={follow && route.length > 1} />
    </MapContainer>
  );
}
