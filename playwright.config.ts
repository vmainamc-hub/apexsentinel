import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    timeout: 30_000,
    fullyParallel: false,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4003',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://127.0.0.1:4003',
        reuseExistingServer: false,
        timeout: 120_000,
    },
    projects: [
        { name: 'mobile-portrait', use: { ...devices['Pixel 5'] } },
        { name: 'mobile-landscape', use: { ...devices['Pixel 5'], viewport: { width: 800, height: 360 } } },
        { name: 'tablet-landscape', use: { ...devices['iPad Mini'], viewport: { width: 844, height: 390 } } },
    ],
});
