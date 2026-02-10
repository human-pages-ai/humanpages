import { test, expect } from '@playwright/test';
import { signupAndGoToDashboard } from './helpers';

// Service creation involves: API call + full profile reload (which computes trust
// score, reputation stats, etc.).  On CI / slow DBs this can take 10-20 s, so we
// use generous assertion timeouts throughout.
const SAVE_TIMEOUT = 30_000;

/** Find the ServicesSection card and click the "Add Service" button to open the form */
async function openServiceForm(page: import('@playwright/test').Page) {
  // The "Services" heading (h2) is inside the ServicesSection card
  const servicesHeading = page.locator('h2', { hasText: /^Services$/ });
  await servicesHeading.waitFor({ timeout: 10_000 });

  // Click the "Add Service" button — could be in the header or the empty-state CTA
  // Use the one nearest the heading (within the same card)
  const card = servicesHeading.locator('..');  // parent of heading
  const addBtn = card.locator('button', { hasText: /Add Service/ });
  await addBtn.first().click();

  // Verify the form opened (title input becomes visible)
  await expect(page.locator('#service-title')).toBeVisible({ timeout: 5_000 });
}

test.describe('Dashboard – Services', () => {
  test('add service with $50/hr pricing', async ({ page }) => {
    await signupAndGoToDashboard(page);
    await openServiceForm(page);

    await page.locator('#service-title').fill('Web Development');
    await page.locator('#service-description').fill('Full-stack web development services');
    await page.locator('#service-category').fill('development');
    await page.locator('#service-price-min').fill('50');
    await page.locator('#service-price-unit').selectOption('HOURLY');

    // Wait for submit button to be enabled (React state must catch up with fill())
    const submitBtn = page.locator('button', { hasText: 'Add Service' }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // Wait for service card to appear (form closes after API + profile reload)
    await expect(page.locator('h3', { hasText: 'Web Development' })).toBeVisible({ timeout: SAVE_TIMEOUT });
    await expect(page.locator('.bg-green-100', { hasText: '$50/hr' })).toBeVisible({ timeout: 5_000 });
  });

  test('add negotiable service', async ({ page }) => {
    await signupAndGoToDashboard(page);
    await openServiceForm(page);

    await page.locator('#service-title').fill('Consulting');
    await page.locator('#service-description').fill('Business consulting and strategy');
    await page.locator('#service-category').fill('consulting');
    await page.locator('#service-price-unit').selectOption('NEGOTIABLE');

    const submitBtn = page.locator('button', { hasText: 'Add Service' }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // Service card title
    await expect(page.locator('h3', { hasText: 'Consulting' })).toBeVisible({ timeout: SAVE_TIMEOUT });
    // "Negotiable" badge (not the <option> element which is hidden)
    await expect(page.locator('.bg-green-100', { hasText: 'Negotiable' })).toBeVisible({ timeout: 5_000 });
  });

  test('add flat-task service with $200/task', async ({ page }) => {
    await signupAndGoToDashboard(page);
    await openServiceForm(page);

    await page.locator('#service-title').fill('Logo Design');
    await page.locator('#service-description').fill('Professional logo design');
    await page.locator('#service-category').fill('design');
    await page.locator('#service-price-min').fill('200');
    await page.locator('#service-price-unit').selectOption('FLAT_TASK');

    const submitBtn = page.locator('button', { hasText: 'Add Service' }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    await expect(page.locator('h3', { hasText: 'Logo Design' })).toBeVisible({ timeout: SAVE_TIMEOUT });
    await expect(page.locator('.bg-green-100', { hasText: '$200/task' })).toBeVisible({ timeout: 5_000 });
  });

  test('toggle and delete service', async ({ page }) => {
    await signupAndGoToDashboard(page);
    await openServiceForm(page);

    await page.locator('#service-title').fill('Temp Service');
    await page.locator('#service-description').fill('Service to be toggled and deleted');
    await page.locator('#service-category').fill('temp');

    const submitBtn = page.locator('button', { hasText: 'Add Service' }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    await expect(page.locator('h3', { hasText: 'Temp Service' })).toBeVisible({ timeout: SAVE_TIMEOUT });

    // The service card has an aria-pressed toggle button
    const serviceCard = page.locator('.bg-gray-50', { hasText: 'Temp Service' });

    // Toggle to inactive
    await serviceCard.locator('[aria-pressed]').click();
    await expect(serviceCard.locator('[aria-pressed="false"]')).toBeVisible({ timeout: SAVE_TIMEOUT });

    // Toggle back to active
    await serviceCard.locator('[aria-pressed]').click();
    await expect(serviceCard.locator('[aria-pressed="true"]')).toBeVisible({ timeout: SAVE_TIMEOUT });

    // Delete service
    await serviceCard.getByRole('button', { name: 'Delete' }).click();

    // Confirm deletion in dialog
    await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Confirm' }).click();

    // Verify service is gone
    await expect(page.locator('h3', { hasText: 'Temp Service' })).not.toBeVisible({ timeout: SAVE_TIMEOUT });
  });
});
