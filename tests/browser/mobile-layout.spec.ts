import { expect, test } from '@playwright/test';

const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 800, height: 360 },
    { width: 844, height: 390 },
    { width: 915, height: 412 },
];

const assertNoOverflow = async (page: any, label: string) => {
    const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(metrics.scrollWidth, `document overflow at ${label}`).toBeLessThanOrEqual(metrics.innerWidth + 1);
    expect(metrics.bodyScrollWidth, `body overflow at ${label}`).toBeLessThanOrEqual(metrics.innerWidth + 1);
};

const assertHitTarget = async (page: any, selector: string, label: string) => {
    const result = await page.locator(selector).first().evaluate((element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
            hit: Boolean(hit && (hit === element || element.contains(hit))),
            pointerEvents: getComputedStyle(element).pointerEvents,
        };
    });

    expect(result.visible, `${label} is not visible`).toBe(true);
    expect(result.width, `${label} is too narrow`).toBeGreaterThanOrEqual(32);
    expect(result.height, `${label} is too short`).toBeGreaterThanOrEqual(32);
    expect(result.pointerEvents, `${label} has disabled pointer events`).not.toBe('none');
    expect(result.hit, `${label} is covered at its center`).toBe(true);
};

test.describe('Apex Sentinel mobile/landscape UI regression', () => {
    for (const viewport of viewports) {
        test(`loads cleanly at ${viewport.width}x${viewport.height}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            const pageErrors: string[] = [];
            page.on('pageerror', error => pageErrors.push(error.message));
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).toBeVisible();
            await page.waitForTimeout(1500);
            await assertNoOverflow(page, `${viewport.width}x${viewport.height}`);

            const fatalScreen = page.getByText('Sorry for the interruption', { exact: false });
            await expect(fatalScreen).toHaveCount(0);
            expect(pageErrors.filter(message => /Loading CSS chunk|ChunkLoadError/i.test(message))).toEqual([]);
        });
    }

    test('Bot Store cards and load controls remain usable in portrait', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/#bot_store', { waitUntil: 'domcontentloaded' });
        await page.locator('#id-bot-store').waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForTimeout(1200);
        await assertNoOverflow(page, 'Bot Store portrait');

        const store = page.locator('.bot-store');
        await expect(store).toBeVisible();
        const cards = page.locator('.bot-card');
        const cardCount = await cards.count();
        expect(cardCount, 'Bot Store rendered no bot cards').toBeGreaterThan(0);

        for (let i = 0; i < cardCount; i++) {
            const card = cards.nth(i);
            const rect = await card.boundingBox();
            expect(rect?.width ?? 0, `Bot Store card ${i + 1} is too wide`).toBeLessThanOrEqual(358);
            expect(rect?.x ?? -1, `Bot Store card ${i + 1} is off-screen`).toBeGreaterThanOrEqual(0);
        }

        expect(await page.locator('.bot-card button').count(), 'Bot Store has no card action buttons').toBeGreaterThan(0);
        await assertHitTarget(page, '.bot-card button', 'Bot Store load/action button');
    });

    test('Run control is visible and tappable in portrait and landscape', async ({ page }) => {
        await page.addInitScript(() => {
            const settings = JSON.parse(localStorage.getItem('dbot_settings') || '{}');
            settings.bot_builder_token = settings.bot_builder_token || 'browser-regression';
            localStorage.setItem('dbot_settings', JSON.stringify(settings));
        });

        for (const viewport of [
            { width: 390, height: 844 },
            { width: 844, height: 390 },
        ]) {
            await page.setViewportSize(viewport);
            await page.goto('/#bot_builder', { waitUntil: 'domcontentloaded' });
            await page.locator('#id-bot-builder').waitFor({ state: 'visible', timeout: 15000 });
            await page.waitForTimeout(1000);

            const tour = page.locator('.tour-dialog').first();
            if (await tour.count() > 0 && await tour.isVisible().catch(() => false)) {
                throw new Error('Mobile onboarding tour remained visible despite returning-user test state');
            }

            const runButton = page.locator('#db-animation__run-button');
            if (await runButton.count() === 0) {
                await page.locator('#id-bot-builder').click();
            }
            await runButton.waitFor({ state: 'visible', timeout: 15000 });
            await assertHitTarget(page, '#db-animation__run-button', `Run button at ${viewport.width}x${viewport.height}`);
            await assertNoOverflow(page, `Bot Builder ${viewport.width}x${viewport.height}`);
        }
    });

    test('landscape run panel geometry stays inside the viewport', async ({ page }) => {
        for (const viewport of [
            { width: 800, height: 360 },
            { width: 844, height: 390 },
            { width: 915, height: 412 },
        ]) {
            await page.setViewportSize(viewport);
            await page.goto('/#bot_builder', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1800);

            const geometry = await page.evaluate(() => {
                const panel = document.querySelector('.dc-drawer') as HTMLElement | null;
                const controls = document.querySelector('.controls__section') as HTMLElement | null;
                const tabs = document.querySelector('.run-panel__content .dc-tabs__list') as HTMLElement | null;
                const rect = (el: HTMLElement | null) => el?.getBoundingClientRect() ?? null;
                const style = (el: HTMLElement | null) =>
                    el
                        ? {
                              width: getComputedStyle(el).width,
                              top: getComputedStyle(el).top,
                              height: getComputedStyle(el).height,
                              bottom: getComputedStyle(el).bottom,
                          }
                        : null;
                return {
                    panel: rect(panel),
                    panelStyle: style(panel),
                    controls: rect(controls),
                    tabs: rect(tabs),
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                };
            });

            expect(geometry.panel, 'landscape drawer is missing').not.toBeNull();
            expect(geometry.controls, 'landscape controls are missing').not.toBeNull();
            expect(geometry.panelStyle?.width).toBe(`${viewport.width}px`);
            expect(geometry.panel?.top ?? -1).toBeGreaterThanOrEqual(0);
            expect(geometry.panel?.left ?? -1).toBeGreaterThanOrEqual(-1);
            expect(geometry.panel?.right ?? Infinity).toBeLessThanOrEqual(geometry.innerWidth + 1);
            expect(geometry.panel?.bottom ?? Infinity).toBeLessThanOrEqual(geometry.innerHeight + 1);
            expect(geometry.panel?.top ?? -1).toBeCloseTo(
                geometry.innerHeight - (geometry.panel?.height ?? geometry.innerHeight),
                1
            );
            expect(geometry.controls?.left ?? -1).toBeGreaterThanOrEqual(-1);
            expect(geometry.controls?.right ?? Infinity).toBeLessThanOrEqual(geometry.innerWidth + 1);
            expect(geometry.controls?.bottom ?? Infinity).toBeLessThanOrEqual(geometry.innerHeight + 1);
            await assertNoOverflow(page, `landscape run panel ${viewport.width}x${viewport.height}`);
        }
    });
});
