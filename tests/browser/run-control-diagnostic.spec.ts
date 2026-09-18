import { expect, test } from '@playwright/test';

async function collectRunDiagnostic(page: import('@playwright/test').Page, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await page.goto('/#bot_builder', { waitUntil: 'domcontentloaded' });
    await page.locator('.bot-builder.bot-builder--active').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.Blockly?.derivWorkspace), undefined, { timeout: 20000 });

    const tour = page.locator('.tour-dialog').first();
    if (await tour.count() > 0 && await tour.isVisible().catch(() => false)) {
        const skip = tour.getByRole('button', { name: 'Skip', exact: true });
        if (await skip.count() > 0) {
            await skip.click();
            await expect(tour).toBeHidden({ timeout: 5000 });
        }
    }

    const button = page.locator('#db-animation__run-button').first();
    await button.waitFor({ state: 'visible', timeout: 20000 });

    return button.evaluate((element: HTMLElement) => {
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
                className: typeof el.className === 'string' ? el.className : String(el.className),
                zIndex: style.zIndex,
                position: style.position,
                pointerEvents: style.pointerEvents,
                transform: style.transform,
                overflow: style.overflow,
                rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
            };
        };
        return {
            button: describe(element),
            hit: describe(document.elementFromPoint(x, y)),
            stack: document.elementsFromPoint(x, y).slice(0, 20).map(describe),
            ancestors: (() => {
                const result = [] as unknown[];
                let node: Element | null = element;
                while (node && result.length < 20) {
                    result.push(describe(node));
                    node = node.parentElement;
                }
                return result;
            })(),
            deviceSignals: {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio,
                drawer: describe(document.querySelector('.dc-drawer')),
                mobileFooter: describe(document.querySelector('.controls__section')),
                animationWrapper: describe(element.closest('.animation__wrapper')),
            },
        };
    });
}

test('diagnose Run control hit target across tablet orientations', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    for (const viewport of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
    ]) {
        const diagnostic = await collectRunDiagnostic(page, viewport.width, viewport.height);
        console.log(`RUN_CONTROL_DIAGNOSTIC ${viewport.width}x${viewport.height} ${JSON.stringify(diagnostic)}`);
        expect(diagnostic.hit, `Run button is covered at ${viewport.width}x${viewport.height}`).toEqual(diagnostic.button);
    }

    if (pageErrors.length) console.log(`RUN_CONTROL_PAGE_ERRORS ${JSON.stringify(pageErrors)}`);
});
