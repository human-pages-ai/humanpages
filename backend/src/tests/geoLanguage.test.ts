import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';

// Mock global fetch for ip-api.com calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function ipApiSuccess(countryCode: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ status: 'success', countryCode, country: countryCode }),
  };
}

function ipApiFail() {
  return {
    ok: true,
    json: () => Promise.resolve({ status: 'fail' }),
  };
}

describe('GET /api/geo/language', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fall back to Accept-Language for localhost IP', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'es-MX,es;q=0.9,en;q=0.8');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('es');
    expect(res.body.source).toBe('accept-language');
    // Should NOT call ip-api.com for localhost
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fall back to English when no Accept-Language on localhost', async () => {
    const res = await request(app)
      .get('/api/geo/language');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('en');
    expect(res.body.source).toBe('accept-language');
  });

  it('should detect French from Accept-Language fr-CA', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'fr-CA,fr;q=0.9,en-US;q=0.8,en;q=0.7');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('fr');
  });

  it('should detect Portuguese from Accept-Language pt-BR', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'pt-BR,pt;q=0.9,en;q=0.8');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('pt');
  });

  it('should detect Chinese from Accept-Language zh-CN', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'zh-CN,zh;q=0.9');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('zh');
  });

  it('should detect Hindi from Accept-Language', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'hi,en;q=0.5');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('hi');
  });

  it('should detect Vietnamese from Accept-Language', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'vi,en;q=0.5');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('vi');
  });

  it('should detect Turkish from Accept-Language', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'tr,en;q=0.5');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('tr');
  });

  it('should detect Thai from Accept-Language', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'th,en;q=0.5');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('th');
  });

  it('should detect Filipino from Accept-Language', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'tl,en;q=0.5');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('tl');
  });

  it('should fall back to English for unsupported Accept-Language', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'de-DE,de;q=0.9');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('en');
  });

  it('should prefer higher q-value Accept-Language entries', async () => {
    const res = await request(app)
      .get('/api/geo/language')
      .set('Accept-Language', 'de;q=0.9,fr;q=0.8,es;q=0.7');

    expect(res.status).toBe(200);
    // German not supported, so should fall back to French (next highest q)
    expect(res.body.language).toBe('fr');
  });

  it('should gracefully handle fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.1')
      .set('Accept-Language', 'es');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('es');
    expect(res.body.source).toBe('accept-language');
  });

  it('should gracefully handle non-OK fetch response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.1')
      .set('Accept-Language', 'tr');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('tr');
    expect(res.body.source).toBe('accept-language');
  });

  it('should gracefully handle ip-api failure status', async () => {
    mockFetch.mockResolvedValueOnce(ipApiFail());

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.1')
      .set('Accept-Language', 'vi');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('vi');
    expect(res.body.source).toBe('accept-language');
  });

  it('should detect Spanish for Mexico IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('MX'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.1');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('es');
    expect(res.body.country).toBe('MX');
    expect(res.body.source).toBe('ip');
  });

  it('should detect Portuguese for Brazil IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('BR'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.2');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('pt');
    expect(res.body.country).toBe('BR');
    expect(res.body.source).toBe('ip');
  });

  it('should detect French for France IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('FR'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.3');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('fr');
    expect(res.body.country).toBe('FR');
    expect(res.body.source).toBe('ip');
  });

  it('should detect Chinese for China IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('CN'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.4');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('zh');
    expect(res.body.country).toBe('CN');
  });

  it('should detect Thai for Thailand IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('TH'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.5');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('th');
    expect(res.body.country).toBe('TH');
  });

  it('should detect Turkish for Turkey IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('TR'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.6');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('tr');
    expect(res.body.country).toBe('TR');
  });

  it('should detect Vietnamese for Vietnam IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('VN'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('vi');
    expect(res.body.country).toBe('VN');
  });

  it('should detect Hindi for India IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('IN'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.8');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('hi');
    expect(res.body.country).toBe('IN');
  });

  it('should detect Filipino for Philippines IP', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('PH'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.9');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('tl');
    expect(res.body.country).toBe('PH');
  });

  it('should fall back to English for unsupported country', async () => {
    mockFetch.mockResolvedValueOnce(ipApiSuccess('JP'));

    const res = await request(app)
      .get('/api/geo/language')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('en');
    expect(res.body.country).toBe('JP');
  });

  // Multilingual country tests
  describe('multilingual countries', () => {
    it('should return French for Canada with French Accept-Language', async () => {
      mockFetch.mockResolvedValueOnce(ipApiSuccess('CA'));

      const res = await request(app)
        .get('/api/geo/language')
        .set('X-Forwarded-For', '203.0.113.20')
        .set('Accept-Language', 'fr-CA,fr;q=0.9,en;q=0.8');

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('fr');
      expect(res.body.country).toBe('CA');
    });

    it('should return English for Canada with English Accept-Language', async () => {
      mockFetch.mockResolvedValueOnce(ipApiSuccess('CA'));

      const res = await request(app)
        .get('/api/geo/language')
        .set('X-Forwarded-For', '203.0.113.21')
        .set('Accept-Language', 'en-CA,en;q=0.9');

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('en');
      expect(res.body.country).toBe('CA');
    });

    it('should default to English for Canada with no Accept-Language', async () => {
      mockFetch.mockResolvedValueOnce(ipApiSuccess('CA'));

      const res = await request(app)
        .get('/api/geo/language')
        .set('X-Forwarded-For', '203.0.113.22');

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('en');
      expect(res.body.country).toBe('CA');
    });

    it('should return English for India with English Accept-Language', async () => {
      mockFetch.mockResolvedValueOnce(ipApiSuccess('IN'));

      const res = await request(app)
        .get('/api/geo/language')
        .set('X-Forwarded-For', '203.0.113.23')
        .set('Accept-Language', 'en-IN,en;q=0.9');

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('en');
      expect(res.body.country).toBe('IN');
    });

    it('should return Hindi for India with Hindi Accept-Language', async () => {
      mockFetch.mockResolvedValueOnce(ipApiSuccess('IN'));

      const res = await request(app)
        .get('/api/geo/language')
        .set('X-Forwarded-For', '203.0.113.24')
        .set('Accept-Language', 'hi,en;q=0.5');

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('hi');
      expect(res.body.country).toBe('IN');
    });

    it('should return Chinese for Singapore with Chinese Accept-Language', async () => {
      mockFetch.mockResolvedValueOnce(ipApiSuccess('SG'));

      const res = await request(app)
        .get('/api/geo/language')
        .set('X-Forwarded-For', '203.0.113.25')
        .set('Accept-Language', 'zh-SG,zh;q=0.9,en;q=0.8');

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('zh');
      expect(res.body.country).toBe('SG');
    });

    it('should return English for Philippines with English Accept-Language', async () => {
      mockFetch.mockResolvedValueOnce(ipApiSuccess('PH'));

      const res = await request(app)
        .get('/api/geo/language')
        .set('X-Forwarded-For', '203.0.113.26')
        .set('Accept-Language', 'en-PH,en;q=0.9');

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('en');
      expect(res.body.country).toBe('PH');
    });
  });
});
