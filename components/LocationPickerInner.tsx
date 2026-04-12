'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, X, LocateFixed, Crosshair } from 'lucide-react';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const BILIRAN_CENTER: [number, number] = [11.5833, 124.3667];
const BILIRAN_ZOOM = 12;
const BILIRAN_BOUNDS: [[number, number], [number, number]] = [
  [11.42, 124.25],
  [11.75, 124.55],
];

type SuggestionResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export type PickedLocation = {
  address: string;
  lat: number;
  lng: number;
};

type Props = {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation | null) => void;
};

// Flies the map to a new position whenever value changes
function MapController({ value }: { value: PickedLocation | null }) {
  const map = useMap();
  const prevRef = useRef<PickedLocation | null>(null);
  useEffect(() => {
    if (value && (prevRef.current?.lat !== value.lat || prevRef.current?.lng !== value.lng)) {
      map.flyTo([value.lat, value.lng], 16, { duration: 0.6 });
    }
    prevRef.current = value;
  }, [map, value]);
  return null;
}

// Only fires click when pinMode is active — prevents accidental pin drops while panning
function MapClickHandler({ pinMode, onPick }: { pinMode: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (pinMode) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPickerInner({ value, onChange }: Props) {
  const [query, setQuery] = useState(value?.address ?? '');
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill query from existing value on mount
  useEffect(() => {
    if (value?.address && !query) setQuery(value.address);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchPlaces = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', `${q}, Biliran, Philippines`);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '6');
      url.searchParams.set('viewbox', '124.25,11.75,124.55,11.42');
      url.searchParams.set('bounded', '1');
      const res = await fetch(url.toString(), { headers: { 'User-Agent': 'order-location-map/1.0' } });
      const data: SuggestionResult[] = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch {
      setSuggestions([]);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchPlaces]);

  function pickSuggestion(s: SuggestionResult) {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    const parts = s.display_name.split(',');
    const shortName = parts.slice(0, 3).join(',').trim();
    onChange({ address: shortName, lat, lng });
    setQuery(shortName);
    setSuggestions([]);
    setPinMode(false);
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('format', 'json');
      const res = await fetch(url.toString(), { headers: { 'User-Agent': 'order-location-map/1.0' } });
      const data = await res.json();
      const parts = (data.display_name as string).split(',');
      return parts.slice(0, 3).join(',').trim();
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  async function handleMapClick(lat: number, lng: number) {
    const address = await reverseGeocode(lat, lng);
    onChange({ address, lat, lng });
    setQuery(address);
    setSuggestions([]);
    setPinMode(false); // exit pin mode after placing
  }

  // Auto-detect location using browser Geolocation API
  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        onChange({ address, lat, lng });
        setQuery(address);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission denied. Please allow access or pick manually.');
        } else {
          setGeoError('Could not detect location. Please pick manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function clear() {
    onChange(null);
    setQuery('');
    setSuggestions([]);
    setPinMode(false);
    setGeoError('');
  }

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(null); }}
          placeholder="Search barangay, street, landmark…"
          className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
        />
        {(query || value) && (
          <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <X size={14} />
          </button>
        )}
        {suggestions.length > 0 && (
          <ul className="absolute z-[9999] left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden text-sm">
            {searching && <li className="px-3 py-2 text-gray-400 text-xs">Searching…</li>}
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button
                  onClick={() => pickSuggestion(s)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-start gap-2 transition"
                >
                  <MapPin size={13} className="text-blue-500 mt-0.5 shrink-0" />
                  <span className="text-xs text-gray-700 line-clamp-2">{s.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Auto-detect location */}
        <button
          onClick={handleDetectLocation}
          disabled={geoLoading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-60 border border-blue-200"
        >
          <LocateFixed size={13} />
          {geoLoading ? 'Detecting…' : 'Use my location'}
        </button>

        {/* Toggle pin-drop mode */}
        <button
          onClick={() => setPinMode((p) => !p)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition border ${
            pinMode
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
          }`}
        >
          <Crosshair size={13} />
          {pinMode ? 'Click map to pin…' : 'Pin on map'}
        </button>
      </div>

      {geoError && <p className="text-[11px] text-red-500">{geoError}</p>}

      {/* Map */}
      <div
        className={`rounded-lg overflow-hidden border-2 transition ${pinMode ? 'border-orange-400 cursor-crosshair' : 'border-gray-200'}`}
        style={{ height: '220px' }}
      >
        <MapContainer
          center={value ? [value.lat, value.lng] : BILIRAN_CENTER}
          zoom={value ? 15 : BILIRAN_ZOOM}
          minZoom={11}
          maxZoom={18}
          maxBounds={BILIRAN_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController value={value} />
          <MapClickHandler pinMode={pinMode} onPick={handleMapClick} />
          {value && <Marker position={[value.lat, value.lng]} />}
        </MapContainer>
      </div>

      {value ? (
        <p className="text-[11px] text-emerald-600 flex items-center gap-1">
          <MapPin size={11} /> {value.address}
        </p>
      ) : (
        <p className="text-[11px] text-gray-400">Search, use your location, or enable pin mode to tap the map.</p>
      )}
    </div>
  );
}
