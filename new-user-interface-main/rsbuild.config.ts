import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
const path = require('path');

export default defineConfig({
    plugins: [
        pluginSass({ sassLoaderOptions: { sourceMap: true, sassOptions: {} }, exclude: /node_modules/ }),
        pluginReact(),
    ],
    source: {
        entry: { index: './src/main.tsx' },
        define: {
            'process.env': {
                APP_ENV: JSON.stringify(process.env.APP_ENV || 'production'),
            },
        },
    },
    resolve: {
        alias: {
            react: path.dirname(require.resolve('react/package.json')),
            'react-dom': path.dirname(require.resolve('react-dom/package.json')),
            '@/config': path.resolve(__dirname, './src/config'),
            '@/services': path.resolve(__dirname, './src/services'),
            '@/external': path.resolve(__dirname, './src/external'),
            '@/components': path.resolve(__dirname, './src/components'),
            '@/hooks': path.resolve(__dirname, './src/hooks'),
            '@/utils': path.resolve(__dirname, './src/utils'),
            '@/constants': path.resolve(__dirname, './src/constants'),
            '@/stores': path.resolve(__dirname, './src/stores'),
        },
    },
    output: {
        copy: [
            { from: 'node_modules/@deriv-com/smartcharts-champion/dist/*', to: 'js/smartcharts/[name][ext]', globOptions: { ignore: ['**/*.LICENSE.txt'] } },
            { from: 'node_modules/@deriv-com/smartcharts-champion/dist/assets/*', to: 'assets/[name][ext]' },
            { from: 'node_modules/@deriv-com/smartcharts-champion/dist/assets/fonts/*', to: 'assets/fonts/[name][ext]' },
            { from: 'node_modules/@deriv-com/smartcharts-champion/dist/assets/shaders/*', to: 'assets/shaders/[name][ext]' },
            { from: path.join(__dirname, 'public'), globOptions: { ignore: ['**/riskmanagers.site/**', '**/termicafx.site/**', '**/dollarsigns.site/**', '**/optimumtraders.site/**', '**/mafiahub.site/**', '**/masterhunter.site/**', '**/mrzetuzetu.site/**', '**/tradinghubs.site/**'] } },
        ],
    },
    html: { template: './index.html' },
    server: { port: 5000, host: '0.0.0.0', compress: true },
    dev: { hmr: true, lazyCompilation: false },
    performance: {
        bundleAnalyze:
            process.env.BUNDLE_ANALYZE === 'true'
                ? { analyzerMode: 'server', analyzerHost: 'localhost', analyzerPort: 8888, openAnalyzer: true, generateStatsFile: true, statsFilename: 'stats.json' }
                : undefined,
    },
    tools: {
        rspack: {
            plugins: [],
            module: { rules: [{ test: /\.xml$/, exclude: /node_modules/, use: 'raw-loader' }] },
        },
    },
});
