/**
 * Shared map marker artwork, so the store looks the same on every map
 * (dashboard, orders map, checkout). Leaflet markers take an HTML string, so the
 * Lucide icon paths (the app's icon set) are inlined here and drawn in white.
 */

export const STORE_ICON_PATHS = '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>';
export const TRUCK_ICON_PATHS = '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>';

export const markerGlyph = (paths: string, x: number, y: number) =>
  `<g transform="translate(${x} ${y}) scale(0.6)" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;

/** The store's map pin (32×40, tip at the bottom centre). */
export const STORE_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" style="display:block;filter:drop-shadow(0 3px 4px rgba(16,24,64,.35))">
    <path d="M16 0C8.268 0 0 6.268 0 16c0 10.667 16 24 16 24S32 26.667 32 16C32 6.268 23.732 0 16 0z"
      fill="#1E4FD8" stroke="white" stroke-width="2"/>
    ${markerGlyph(STORE_ICON_PATHS, 8.8, 8.3)}
  </svg>`;
