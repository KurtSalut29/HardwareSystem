export type GeocodeResult = { lat: number; lng: number } | null;

// Biliran Island bounding box — only accept results within this area
const BILIRAN_BBOX = {
  minLat: 11.42, maxLat: 11.75,
  minLng: 124.25, maxLng: 124.55,
};

function isWithinBiliran(lat: number, lng: number): boolean {
  return (
    lat >= BILIRAN_BBOX.minLat && lat <= BILIRAN_BBOX.maxLat &&
    lng >= BILIRAN_BBOX.minLng && lng <= BILIRAN_BBOX.maxLng
  );
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    // Bias results toward Biliran Island
    url.searchParams.set("viewbox", "124.25,11.75,124.55,11.42");
    url.searchParams.set("bounded", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "order-location-map/1.0",
      },
    });

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Pick the first result that falls within Biliran bounds
    for (const item of data) {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      if (isWithinBiliran(lat, lng)) {
        return { lat, lng };
      }
    }

    return null;
  } catch {
    return null;
  }
}
