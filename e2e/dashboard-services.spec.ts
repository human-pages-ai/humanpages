import { test, expect } from '@playwright/test';
import { signupAndGoToDashboard } from './helpers';

// Service creation involves: API call + full profile reload (which computes trust
// score, reputation stats, etc.).  On CI / slow DBs this can take 10-20 s, so we
// use generous assertion timeouts throughout.
const SAVE_TIMEOUT = 30_000;

/** Find the ServicesSection card and click the "Add Service" button to open the form */
async function openServiceForm(page: import('@playwright/test').Page) {
  // Navigate to the Profile tab where services now live
  await page.getByRole('tab', { name: /profile/i }).click();

  // The services section lives inside the Profile tab (id="services-section")
  const section = page.locator('#services-section');
  await section.waitFor({ timeout: 10_000 });

  // Click any "Add Service" button within the section (header toggle or empty-state CTA)
  await section.getByRole('button', { name: 'Add Service' }).first().click();

  // Verify the form opened (title input becomes visible)
  await expect(page.locator('#service-title')).toBeVisible({ timeout: 5_000 });
}

/** Select a category from the searchable combobox by typing and clicking the option */
async function selectCategory(page: import('@playwright/test').Page, category: string) {
  const input = page.locator('#service-category');
  await input.click();
  await input.fill(category);
  // Click the matching option in the dropdown
  await page.locator(`button:text-is("${category}")`).click();
}

test.describe('Dashboard – Services', () => {
  test('add service with $50/hr pricing', async ({ page }) => {
    await signupAndGoToDashboard(page);
    await openServiceForm(page);

    await page.locator('#service-title').fill('Web Development');
    await page.locator('#service-description').fill('Full-stack web development services');
    await selectCategory(page, 'Web Development');

    // Select unit first (price fields appear after selecting HOURLY/FLAT_TASK)
    await page.locator('#service-price-unit').selectOption('HOURLY');
    await page.locator('#service-price-min').fill('50');

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
    await selectCategory(page, 'Business Consulting');
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
    await selectCategory(page, 'Logo Design');

    // Select unit first, then fill price
    await page.locator('#service-price-unit').selectOption('FLAT_TASK');
    await page.locator('#service-price-min').fill('200');

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
    await selectCategory(page, 'Other');

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
    const dialog = page.locator('[role="alertdialog"]');
    await dialog.waitFor({ timeout: 5_000 });
    await dialog.getByRole('button', { name: 'Confirm' }).click();

    // Verify service is gone (wait for dialog to close and profile to reload)
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('h3', { hasText: 'Temp Service' })).toHaveCount(0, { timeout: SAVE_TIMEOUT });
  });
});
