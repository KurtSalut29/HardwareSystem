'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, X, LocateFixed, Crosshair, AlertTriangle } from 'lucide-react';
import { BILIRAN_CENTER, BILIRAN_LEAFLET_BOUNDS, BILIRAN_VIEWBOX, isWithinBiliran } from '@/lib/biliran';

/**
 * "Use my location" keeps listening for a better GPS fix instead of taking the
 * first answer, which on many devices is a rough WiFi/cell guess. It stops as
 * soon as a fix is this good, or after the wait below, keeping the best one.
 */
const GOOD_ENOUGH_M = 25;
const MAX_WAIT_MS = 12000;
/** Past this, the fix is a rough guess: the customer is asked to drag the pin onto their house. */
const ROUGH_M = 100;

const fmtAccuracy = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const BILIRAN_ZOOM = 12;

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
  const initializedRef = useRef(false);

  useEffect(() => {
    // On first mount, always set view to Biliran center or value
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (value) {
        map.setView([value.lat, value.lng], 16);
      } else {
        map.setView(BILIRAN_CENTER, BILIRAN_ZOOM);
      }
      return;
    }
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
  // How sure the device is about the GPS pin, in metres (null once placed by hand).
  const [accuracy, setAccuracy] = useState<number | null>(null);
  // Live accuracy while still listening for a better fix.
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchRef = useRef<{ id: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Stop listening for GPS if the picker goes away mid-search.
  useEffect(() => () => {
    if (watchRef.current) { navigator.geolocation.clearWatch(watchRef.current.id); clearTimeout(watchRef.current.timer); }
  }, []);

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
      url.searchParams.set('viewbox', BILIRAN_VIEWBOX);
      url.searchParams.set('bounded', '1');
      const res = await fetch(url.toString(), { headers: { 'User-Agent': 'order-location-map/1.0' } });
      const data: SuggestionResult[] = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch {
      setSuggestions([]);
    }
    setSearching(false);
  }, []);

  // The box now shows the picked place's address (from a pin, GPS or a suggestion):
  // don't search it again, or a dropdown pops open over the map for no reason.
  const pickedAddress = value?.address ?? null;
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (pickedAddress && query === pickedAddress) return;
    debounceRef.current = setTimeout(() => searchPlaces(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchPlaces, pickedAddress]);

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
    // Placed by hand (tap or drag): exactly where the customer put it.
    setAccuracy(null);
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
    if (watchRef.current) return; // already listening
    setGeoLoading(true);
    setGeoError('');
    setLiveAccuracy(null);

    let best: GeolocationPosition | null = null;
    const finish = async (err?: GeolocationPositionError) => {
      if (!watchRef.current) return;
      navigator.geolocation.clearWatch(watchRef.current.id);
      clearTimeout(watchRef.current.timer);
      watchRef.current = null;
      setLiveAccuracy(null);

      if (!best) {
        setGeoLoading(false);
        setGeoError(err && err.code === err.PERMISSION_DENIED
          ? 'Location blocked. Allow location for this site, or search your barangay / tap "Pin on map" instead.'
          : 'Could not detect your location. Search your barangay or tap "Pin on map".');
        return;
      }
      const { latitude: lat, longitude: lng, accuracy: acc } = best.coords;
      if (!isWithinBiliran(lat, lng)) {
        setGeoLoading(false);
        setGeoError(`Your device placed you outside Biliran (±${fmtAccuracy(acc)}), which usually means it guessed from the internet connection. Search your barangay or tap "Pin on map" instead.`);
        return;
      }
      const address = await reverseGeocode(lat, lng);
      setAccuracy(acc);
      onChange({ address, lat, lng });
      setQuery(address);
      setSuggestions([]);
      setGeoLoading(false);
    };

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        setLiveAccuracy(best.coords.accuracy);
        if (best.coords.accuracy <= GOOD_ENOUGH_M) finish();
      },
      (err) => {
        // Permission denied is final; a timeout just means keep the best fix so far.
        if (err.code === err.PERMISSION_DENIED || !best) finish(err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT_MS },
    );
    watchRef.current = { id, timer: setTimeout(() => finish(), MAX_WAIT_MS) };
  }

  function clear() {
    setAccuracy(null);
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
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(null); }}
          // Inside a form (signup, checkout), Enter here would submit it; pick the first suggestion instead.
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (suggestions[0]) pickSuggestion(suggestions[0]); } }}
          aria-label="Search for your location"
          placeholder="Search barangay, street, landmark…"
          className="w-full pl-8 pr-8 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
        />
        {(query || value) && (
          <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-3">
            <X size={14} />
          </button>
        )}
        {suggestions.length > 0 && (
          <ul className="absolute z-[9999] left-0 right-0 top-full mt-1 bg-surface border border-line rounded-lg shadow-lg overflow-hidden text-sm">
            {searching && <li className="px-3 py-2 text-ink-4 text-xs">Searching…</li>}
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button type="button"
                  onClick={() => pickSuggestion(s)}
                  className="w-full text-left px-3 py-2 hover:bg-brand-soft flex items-start gap-2 transition"
                >
                  <MapPin size={13} className="text-brand mt-0.5 shrink-0" />
                  <span className="text-xs text-ink-2 line-clamp-2">{s.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Auto-detect location */}
        <button type="button"
          onClick={handleDetectLocation}
          disabled={geoLoading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-soft text-brand hover:bg-brand-soft transition disabled:opacity-60 border border-brand/30"
        >
          <LocateFixed size={13} />
          {geoLoading ? (liveAccuracy != null ? `Finding you… ±${fmtAccuracy(liveAccuracy)}` : 'Finding you…') : 'Use my location'}
        </button>

        {/* Toggle pin-drop mode */}
        <button type="button"
          onClick={() => setPinMode((p) => !p)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition border ${
            pinMode
              ? 'bg-brand text-white border-brand'
              : 'bg-subtle text-ink-2 hover:bg-recess border-line'
          }`}
        >
          <Crosshair size={13} />
          {pinMode ? 'Click map to pin…' : 'Pin on map'}
        </button>
      </div>

      {geoError && <p className="text-[11px] text-bad">{geoError}</p>}
      {value && accuracy != null && accuracy > ROUGH_M && (
        <p className="text-[11px] rounded-lg px-2.5 py-2 flex items-start gap-1.5" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
          <AlertTriangle size={13} className="shrink-0 mt-px" />
          <span>
            Your device could only find a rough location (within about {fmtAccuracy(accuracy)}). Computers without GPS guess from WiFi.
            <b> Drag the pin onto your house</b>, or use a phone with GPS turned on.
          </span>
        </p>
      )}

      {/* Map */}
      <div
        className={`rounded-lg overflow-hidden border-2 transition ${pinMode ? 'border-brand cursor-crosshair' : 'border-line'}`}
        style={{ height: '220px' }}
      >
        <MapContainer
          center={value ? [value.lat, value.lng] : BILIRAN_CENTER}
          zoom={value ? 15 : BILIRAN_ZOOM}
          minZoom={11}
          maxZoom={18}
          maxBounds={BILIRAN_LEAFLET_BOUNDS}
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
          {/* How far off a GPS pin could be */}
          {value && accuracy != null && (
            <Circle center={[value.lat, value.lng]} radius={accuracy}
              pathOptions={{ color: accuracy > ROUGH_M ? '#B4670A' : '#1E4FD8', weight: 1, fillOpacity: 0.12 }} />
          )}
          {/* Drag the pin to put it exactly on the house */}
          {value && (
            <Marker position={[value.lat, value.lng]} draggable
              eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); handleMapClick(ll.lat, ll.lng); } }} />
          )}
        </MapContainer>
      </div>

      {value ? (
        <div className="text-[11px] space-y-0.5">
          <p className="text-good flex items-center gap-1"><MapPin size={11} className="shrink-0" /> {value.address}</p>
          <p className="text-ink-4">
            {accuracy != null && accuracy <= ROUGH_M ? `Located within about ${fmtAccuracy(accuracy)}. ` : ''}
            Not quite right? Drag the pin onto your house.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-ink-4">Search, use your location, or enable pin mode to tap the map.</p>
      )}
    </div>
  );
}
