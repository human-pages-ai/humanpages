import { test, expect, request as pwRequest } from '@playwright/test';
import { signupAndGoToDashboard, API_BASE } from './helpers';

test.describe('Public Profile', () => {
  test('view profile with services and skills', async ({ page }) => {
    const { token } = await signupAndGoToDashboard(page);

    // Use a standalone API context for direct API calls
    const api = await pwRequest.newContext({ baseURL: API_BASE });

    const profileRes = await api.get('/api/humans/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(profileRes.ok()).toBeTruthy();
    const profile = await profileRes.json();

    await api.patch('/api/humans/me', {
      headers: { Authorization: `Bearer ${token}` },
      data: { skills: ['testing', 'automation'], bio: 'E2E test bio', contactEmail: 'pub@test.com' },
    });

    await api.post('/api/services', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'QA Testing', description: 'Quality assurance', category: 'tech', priceMin: 75, priceUnit: 'HOURLY' },
    });

    await api.dispose();

    // Navigate to public profile
    await page.goto(`/humans/${profile.id}`);
    await page.waitForSelector('h1', { timeout: 10_000 });

    await expect(page.locator('h1')).toContainText('E2E User');
    await expect(page.getByText('testing', { exact: true })).toBeVisible();
    await expect(page.getByText('automation', { exact: true })).toBeVisible();
    await expect(page.getByText('QA Testing')).toBeVisible();
    await expect(page.locator('text=$75/hr')).toBeVisible();
  });

  test('JSON-LD structured data', async ({ page }) => {
    const { token } = await signupAndGoToDashboard(page);

    const api = await pwRequest.newContext({ baseURL: API_BASE });

    const profileRes = await api.get('/api/humans/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await profileRes.json();

    await api.patch('/api/humans/me', {
      headers: { Authorization: `Bearer ${token}` },
      data: { skills: ['coding'], bio: 'A coder' },
    });
    await api.post('/api/services', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Coding Service', description: 'I write code', category: 'dev', priceMin: 100, priceUnit: 'HOURLY' },
    });

    await api.dispose();

    await page.goto(`/humans/${profile.id}`);
    await page.waitForSelector('h1', { timeout: 10_000 });

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toBeTruthy();
    const data = JSON.parse(jsonLd!);
    expect(data['@type']).toBe('Person');
    expect(data.name).toBe('E2E User');
    expect(data.knowsAbout).toContain('coding');
    expect(data.makesOffer).toBeDefined();
    expect(data.makesOffer[0].itemOffered.name).toBe('Coding Service');
  });

  test('contact hidden when hideContact is true', async ({ page }) => {
    const { token } = await signupAndGoToDashboard(page);

    const api = await pwRequest.newContext({ baseURL: API_BASE });

    const profileRes = await api.get('/api/humans/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await profileRes.json();

    await api.patch('/api/humans/me', {
      headers: { Authorization: `Bearer ${token}` },
      data: { hideContact: true },
    });

    await api.dispose();

    await page.goto(`/humans/${profile.id}`);
    await page.waitForSelector('h1', { timeout: 10_000 });

    await expect(page.locator('text=Contact info is private')).toBeVisible();
  });
});
