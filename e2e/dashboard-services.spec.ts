import { test, expect } from '@playwright/test';
import { signupAndGoToDashboard } from './helpers';

test.describe('Dashboard – Services', () => {
  test('add service with $50/hr pricing', async ({ page }) => {
    await signupAndGoToDashboard(page);

    const servicesSection = page.locator('#services-section');
    await servicesSection.scrollIntoViewIfNeeded();
    // Click "Add Service" in the header (not the empty state button)
    await servicesSection.locator('button, a', { hasText: 'Add Service' }).first().click();

    await page.locator('#service-title').fill('Web Development');
    await page.locator('#service-description').fill('Full-stack web development services');
    await page.locator('#service-category').fill('development');
    await page.locator('#service-price-min').fill('50');
    await page.locator('#service-price-unit').selectOption('HOURLY');

    // Wait for submit button to be enabled (React state must catch up with fill())
    const submitBtn = servicesSection.locator('button', { hasText: 'Add Service' }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // Wait for service card to appear (form closes, card renders)
    await expect(servicesSection.locator('h3', { hasText: 'Web Development' })).toBeVisible({ timeout: 5000 });
    await expect(servicesSection).toContainText('$50/hr');
  });

  test('add negotiable service', async ({ page }) => {
    await signupAndGoToDashboard(page);

    const servicesSection = page.locator('#services-section');
    await servicesSection.scrollIntoViewIfNeeded();
    await servicesSection.locator('button, a', { hasText: 'Add Service' }).first().click();

    await page.locator('#service-title').fill('Consulting');
    await page.locator('#service-description').fill('Business consulting and strategy');
    await page.locator('#service-category').fill('consulting');
    await page.locator('#service-price-unit').selectOption('NEGOTIABLE');

    await servicesSection.locator('button', { hasText: 'Add Service' }).last().click();

    await expect(servicesSection).toContainText('Consulting');
    await expect(servicesSection).toContainText('Negotiable');
  });

  test('add flat-task service with $200/task', async ({ page }) => {
    await signupAndGoToDashboard(page);

    const servicesSection = page.locator('#services-section');
    await servicesSection.scrollIntoViewIfNeeded();
    await servicesSection.locator('button, a', { hasText: 'Add Service' }).first().click();

    await page.locator('#service-title').fill('Logo Design');
    await page.locator('#service-description').fill('Professional logo design');
    await page.locator('#service-category').fill('design');
    await page.locator('#service-price-min').fill('200');
    await page.locator('#service-price-unit').selectOption('FLAT_TASK');

    await servicesSection.locator('button', { hasText: 'Add Service' }).last().click();

    await expect(servicesSection).toContainText('Logo Design');
    await expect(servicesSection).toContainText('$200/task');
  });

  test('toggle and delete service', async ({ page }) => {
    await signupAndGoToDashboard(page);

    const servicesSection = page.locator('#services-section');
    await servicesSection.scrollIntoViewIfNeeded();
    await servicesSection.locator('button, a', { hasText: 'Add Service' }).first().click();

    await page.locator('#service-title').fill('Temp Service');
    await page.locator('#service-description').fill('Service to be toggled and deleted');
    await page.locator('#service-category').fill('temp');

    await servicesSection.locator('button', { hasText: 'Add Service' }).last().click();
    await expect(servicesSection).toContainText('Temp Service');

    // The service card has an aria-pressed toggle button
    const serviceCard = servicesSection.locator('.bg-gray-50', { hasText: 'Temp Service' });

    // Toggle to inactive - find the button with aria-pressed
    await serviceCard.locator('[aria-pressed]').click();
    await expect(serviceCard.locator('[aria-pressed="false"]')).toBeVisible({ timeout: 5_000 });

    // Toggle back to active
    await serviceCard.locator('[aria-pressed]').click();
    await expect(serviceCard.locator('[aria-pressed="true"]')).toBeVisible({ timeout: 5_000 });

    // Delete service
    await serviceCard.getByRole('button', { name: 'Delete' }).click();

    // Confirm deletion in dialog
    await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Confirm' }).click();

    // Verify service is gone
    await expect(servicesSection.locator('text=Temp Service')).not.toBeVisible({ timeout: 5_000 });
  });
});
