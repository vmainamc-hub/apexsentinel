import { expect, test } from '@playwright/test';

test('diagnose landscape Run control hit target', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/#bot_builder', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);

    const tour = page.locator('.tour-dialog').first();
    if (await tour.count() > 0 && await tour.isVisible().catch(() => false)) {
        const skip = tour.getByRole('button', { name: 'Skip', exact: true });
        if (await skip.count() > 0) {
            await skip.click();
            await expect(tour).toBeHidden({ timeout: 5000 });
        }
    }

    const button = page.locator('#db-animation__run-button').first();
    await button.waitFor({ state: 'visible', timeout: 15000 });

    const diagnostic = await button.evaluate((element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const describe = (node: Element | null) => {
            if (!node) return null;
            const el = node as HTMLElement;
            const style = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
                tag: el.tagName,
                id: el.id,
                className: el.className,
                zIndex: style.zIndex,
                position: style.position,
                pointerEvents: style.pointerEvents,
                rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
            };
        };
        return {
            button: describe(element),
            hit: describe(document.elementFromPoint(x, y)),
            stack: document.elementsFromPoint(x, y).slice(0, 12).map(describe),
            ancestors: (() => {
                const result = [] as unknown[];
                let node: Element | null = element;
                while (node && result.length < 12) {
                    result.push(describe(node));
                    node = node.parentElement;
                }
                return result;
            })(),
        };
    });

    console.log(`LANDSCAPE_RUN_DIAGNOSTIC ${JSON.stringify(diagnostic)}`);
    expect(diagnostic.hit, 'Diagnostic: Run button is covered').toEqual(diagnostic.button);
});
