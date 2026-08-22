import { BILIRAN_VIEWBOX, isWithinBiliran } from "./biliran";

export type GeocodeResult = { lat: number; lng: number } | null;

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    // Bias results toward Biliran province
    url.searchParams.set("viewbox", BILIRAN_VIEWBOX);
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

    // Pick the first result that falls within the service area
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
