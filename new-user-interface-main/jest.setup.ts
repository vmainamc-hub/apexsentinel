import '@testing-library/jest-dom/jest-globals';
import '@testing-library/jest-dom';

let originalLocalStorage: Storage;
const localStorageMock: Storage = {
    clear() {
        this.store = {};
    },
    getItem(key) {
        return this.store[key];
    },
    key() {
        return 'test key';
    },
    length: 0,
    removeItem(key) {
        delete this.store[key];
    },
    setItem(key, value) {
        this.store[key] = value.toString();
    },
    store: {},
};

export const mockLocalStorageBeforeEachTest = () => {
    originalLocalStorage = global.localStorage;
    Object.defineProperty(global, 'localStorage', { value: localStorageMock });
};

export const restoreLocalStorageAfterEachTest = () => {
    Object.defineProperty(global, 'localStorage', { value: originalLocalStorage });
};

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
    })),
});

// Mock fetch for tests
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    })
) as jest.Mock;

// jsdom 20 (jest-environment-jsdom 29) does not expose crypto.randomUUID, which browsers provide and the app uses
// (combo rows, journal ids, chart ids, upload ids). Polyfill it from Node only when the environment lacks it.
if (typeof globalThis.crypto?.randomUUID !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUUID } = require('crypto');
    Object.defineProperty(globalThis, 'crypto', {
        value: Object.assign(globalThis.crypto ?? {}, { randomUUID }),
        configurable: true,
    });
}
