import { prisma } from './prisma.js';
import { logger } from './logger.js';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * Geocode a location string, using a Postgres cache to avoid repeated Nominatim calls.
 * Returns null if the location cannot be resolved.
 */
export async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized || normalized.length > 200) return null;

  // Check cache first
  const cached = await prisma.geoCache.findUnique({ where: { query: normalized } });
  if (cached) {
    return { lat: cached.lat, lng: cached.lng, displayName: cached.displayName };
  }

  // Call Nominatim
  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      addressdetails: '1',
      limit: '1',
      'accept-language': 'en',
    });

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'HumanPages/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Nominatim API error');
      return null;
    }

    const data = await res.json() as any[];
    if (!data.length) return null;

    const r = data[0];
    const addr = r.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || '';
    const state = addr.state || '';
    const country = addr.country || '';
    const displayName = [city, state, country].filter(Boolean).join(', ') || r.display_name;
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);

    if (isNaN(lat) || isNaN(lng)) return null;

    // Cache the result (upsert handles race conditions)
    await prisma.geoCache.upsert({
      where: { query: normalized },
      create: { query: normalized, displayName, lat, lng },
      update: { displayName, lat, lng },
    });

    return { lat, lng, displayName };
  } catch (err) {
    logger.warn({ err, query: normalized }, 'Geocoding failed');
    return null;
  }
}
