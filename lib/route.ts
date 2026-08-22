/**
 * Driving directions from OSRM (free, no API key) — used by the in-system
 * navigation screen so drivers never have to leave the app for Google Maps.
 */

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  road: string;
};

export type DrivingRoute = {
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  steps: RouteStep[];
};

type OsrmManeuver = { type?: string; modifier?: string };
type OsrmStep = { maneuver?: OsrmManeuver; name?: string; distance?: number };

const MODIFIER_TEXT: Record<string, string> = {
  left: "left",
  right: "right",
  "sharp left": "sharp left",
  "sharp right": "sharp right",
  "slight left": "slight left",
  "slight right": "slight right",
  straight: "straight",
  uturn: "around",
};

/** OSRM returns maneuver codes; turn them into something a driver can read. */
function describe(step: OsrmStep, isLast: boolean): string {
  const type = step.maneuver?.type ?? "";
  const mod = MODIFIER_TEXT[step.maneuver?.modifier ?? ""] ?? "";
  const road = (step.name ?? "").trim();
  const onRoad = road ? ` onto ${road}` : "";

  if (isLast || type === "arrive") return "Arrive at the drop-off";
  if (type === "depart") return road ? `Head out on ${road}` : "Start driving";
  if (type === "roundabout" || type === "rotary") return `Take the roundabout${onRoad}`;
  if (type === "merge") return `Merge${onRoad}`;
  if (type === "fork") return `Keep ${mod || "going"}${onRoad}`;
  if (type === "end of road") return `Turn ${mod || "at the end of the road"}${onRoad}`;
  if (type === "new name") return road ? `Continue on ${road}` : "Continue";
  if (type === "continue") return `Continue ${mod}`.trim() + onRoad;
  if (type === "turn") return `Turn ${mod || ""}`.trim() + onRoad;
  return road ? `Continue on ${road}` : "Continue";
}

export async function fetchDrivingRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): Promise<DrivingRoute | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}` +
      `?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (data?.code !== "Ok" || !route) return null;

    // GeoJSON is [lng, lat]; Leaflet wants [lat, lng]
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng],
    );

    const raw: OsrmStep[] = route.legs?.[0]?.steps ?? [];
    const steps: RouteStep[] = raw.map((s, i) => ({
      instruction: describe(s, i === raw.length - 1),
      distanceMeters: Math.round(s.distance ?? 0),
      road: (s.name ?? "").trim(),
    }));

    return {
      coords,
      distanceKm: route.distance / 1000,
      durationMin: Math.round(route.duration / 60),
      steps,
    };
  } catch {
    return null; // offline or OSRM down — caller falls back to straight-line info
  }
}
