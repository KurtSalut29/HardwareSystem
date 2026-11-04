'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

const storePin = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 1C8.7 1 2 7.6 2 15.8 2 27 17 43 17 43s15-16 15-27.2C32 7.6 25.3 1 17 1z"
      fill="#1E4FD8" stroke="white" stroke-width="2"/>
    <circle cx="17" cy="16" r="5.5" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

// A single, non-interactive-by-scroll map of the store's saved pin for the public landing page.
export default function StoreMapInner({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={storePin} title={name} alt={name} />
    </MapContainer>
  );
}
