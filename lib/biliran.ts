/**
 * Service-area bounds for Biliran province — the single source of truth for the
 * maps, the location picker, and address geocoding.
 *
 * The earlier box stopped at 124.55 longitude, which cut off the whole eastern
 * side of the island: Cabucgayan (124.575) and Caibiran (124.581) fell outside
 * it. Geocoding those addresses either failed outright or silently returned a
 * different place that happened to sit inside the box, so orders landed several
 * kilometres from the customer. These bounds cover the mainland plus Maripipi.
 */
export const BILIRAN_BOUNDS = {
  minLat: 11.40, maxLat: 11.85,
  minLng: 124.30, maxLng: 124.65,
} as const;

/** Leaflet order: [[southWestLat, southWestLng], [northEastLat, northEastLng]] */
export const BILIRAN_LEAFLET_BOUNDS: [[number, number], [number, number]] = [
  [BILIRAN_BOUNDS.minLat, BILIRAN_BOUNDS.minLng],
  [BILIRAN_BOUNDS.maxLat, BILIRAN_BOUNDS.maxLng],
];

/** Nominatim viewbox order: left,top,right,bottom */
export const BILIRAN_VIEWBOX =
  `${BILIRAN_BOUNDS.minLng},${BILIRAN_BOUNDS.maxLat},${BILIRAN_BOUNDS.maxLng},${BILIRAN_BOUNDS.minLat}`;

/** Roughly the middle of the province, so both coasts are visible. */
export const BILIRAN_CENTER: [number, number] = [11.58, 124.47];

export function isWithinBiliran(lat: number, lng: number): boolean {
  return (
    lat >= BILIRAN_BOUNDS.minLat && lat <= BILIRAN_BOUNDS.maxLat &&
    lng >= BILIRAN_BOUNDS.minLng && lng <= BILIRAN_BOUNDS.maxLng
  );
}
