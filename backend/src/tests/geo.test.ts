import { describe, it, expect } from 'vitest';
import { calculateDistance } from '../lib/geo.js';

describe('geo utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      // New York to Los Angeles (approximately 3,944 km)
      const nyLat = 40.7128;
      const nyLng = -74.006;
      const laLat = 34.0522;
      const laLng = -118.2437;

      const distance = calculateDistance(nyLat, nyLng, laLat, laLng);

      // Should be approximately 3,944 km (allow 50km margin)
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should return 0 for same coordinates', () => {
      const lat = 40.7128;
      const lng = -74.006;

      const distance = calculateDistance(lat, lng, lat, lng);

      expect(distance).toBe(0);
    });

    it('should calculate short distances accurately', () => {
      // Two points approximately 1 km apart in London
      const lat1 = 51.5074;
      const lng1 = -0.1278;
      const lat2 = 51.5155;
      const lng2 = -0.1419;

      const distance = calculateDistance(lat1, lng1, lat2, lng2);

      // Should be approximately 1.2 km
      expect(distance).toBeGreaterThan(0.5);
      expect(distance).toBeLessThan(2);
    });

    it('should work with positive and negative coordinates', () => {
      // Sydney to Tokyo
      const sydneyLat = -33.8688;
      const sydneyLng = 151.2093;
      const tokyoLat = 35.6762;
      const tokyoLng = 139.6503;

      const distance = calculateDistance(sydneyLat, sydneyLng, tokyoLat, tokyoLng);

      // Should be approximately 7,800 km
      expect(distance).toBeGreaterThan(7700);
      expect(distance).toBeLessThan(7900);
    });
  });
});
