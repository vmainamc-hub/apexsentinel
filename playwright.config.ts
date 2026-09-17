import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    timeout: 30_000,
    fullyParallel: false,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4003',
        isMobile: true,
        hasTouch: true,
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://127.0.0.1:4003',
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
