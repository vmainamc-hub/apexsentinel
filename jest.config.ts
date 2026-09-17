/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import fs from 'fs';
import path from 'path';

import type { Config } from 'jest';

// `@deriv-com/ui` defines no CJS main in its `exports` map, so jest can't
// resolve it via node resolution — it must be mapped to the package directory.
// Resolve that directory robustly for both the monorepo (npm workspaces hoist
// it to the repo root) and a standalone build (local node_modules).
const derivComUiDir =
    [
        path.join(__dirname, 'node_modules/@deriv-com/ui'),
        path.join(__dirname, '../../node_modules/@deriv-com/ui'),
    ].find(candidate => fs.existsSync(candidate)) ?? path.join(__dirname, 'node_modules/@deriv-com/ui');

const config: Config = {
    // All imported modules in your tests should be mocked automatically
    // automock: false,

    // Stop running tests after `n` failures
    // bail: 0,

    // The directory where Jest should store its cached dependency information
    // cacheDirectory: "/private/var/folders/sb/ck126x0n5zgf7g12_nb8gm0h0000gn/T/jest_dx",

    // Automatically clear mock calls, instances, contexts and results before every test
    clearMocks: true,

    // Indicates whether the coverage information should be collected while executing the test
    collectCoverage: true,

    // An array of glob patterns indicating a set of files for which coverage information should be collected
    // collectCoverageFrom: undefined,

    // The directory where Jest should output the coverage files
    coverageDirectory: 'coverage',

    // An array of regexp pattern strings used to skip coverage collection
    coveragePathIgnorePatterns: ['/node_modules/'],

    // Indicates which provider should be used to instrument the code for the test
    coverageProvider: 'v8',

    // An object that configures minimum coverage threshold enforcement for coverage results
    // coverageThreshold: undefined,

    moduleDirectories: ['node_modules', 'bower_components', 'shared'],
    moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'node'],

    moduleNameMapper: {
        '\\.(css|less|scss)$': '<rootDir>/__mocks__/styleMock.js',
        '\\.(gif|ttf|eot|svg)$': '<rootDir>/__mocks__/fileMock.js',
        'react-dom/server': '<rootDir>/__mocks__/react-dom-server.js',
        '@deriv-com/translations': '<rootDir>/__mocks__/translation.mock.js',
        '@deriv-com/ui': derivComUiDir,
        '^@/external/(.*)$': '<rootDir>/src/external/$1',
        '^@/adapters/(.*)$': '<rootDir>/src/adapters/$1',
        '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@/components/(.*)$': '<rootDir>/src/components/$1',
        '^@/constants/(.*)$': '<rootDir>/src/constants/$1',
        '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
        '^@/stores/(.*)$': '<rootDir>/src/stores/$1',
        '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
        '^@/services/(.*)$': '<rootDir>/src/services/$1',
        '^@/translations$': '<rootDir>/src/translations',
        '^@/\\.\\./brand\\.config\\.json$': '<rootDir>/brand.config.json',
    },

    preset: 'ts-jest',
    rootDir: __dirname,
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testEnvironment: 'jsdom',
    testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],

    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx|mjs|cjs)$': 'babel-jest',
        '^.+\\.xml$': 'jest-transform-stub',
    },

    // react-router@8 and its ESM-only transitive packages must be transformed
    // by babel-jest instead of being executed as untransformed CommonJS.
    transformIgnorePatterns: [
        '/node_modules/(?!(@deriv-com/ui|react-router|@remix-run|cookie-es)/)',
    ],
};

export default config;
