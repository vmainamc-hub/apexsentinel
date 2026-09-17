import { expect, test } from '@playwright/test';

const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 800, height: 360 },
    { width: 844, height: 390 },
    { width: 915, height: 412 },
];

test.describe('mobile layout smoke checks', () => {
    for (const viewport of viewports) {
        test(`loads without horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            const errors: string[] = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).toBeVisible();
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
            expect(overflow, `horizontal overflow at ${viewport.width}x${viewport.height}`).toBe(false);
            expect(errors, 'uncaught browser errors').toEqual([]);
        });
    }
});
