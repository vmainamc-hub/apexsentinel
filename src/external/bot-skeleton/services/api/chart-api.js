import { generateDerivApiInstance } from './appId';

/**
 * Shared Deriv chart transport.
 *
 * DTrader/SmartChart must consume the same API instance owned by APIBase.
 * This module intentionally never creates or reconnects its own WebSocket.
 */
class ChartAPI {
    api = null;
    readyListeners = new Set();
    time_interval = null;

    setApi = api => {
        this.api = api || null;
        if (this.api) {
            this.readyListeners.forEach(listener => {
                try {
                    listener(this.api);
                } catch (error) {
                    console.error('[ChartAPI] ready listener failed:', error);
                }
            });
            this.getTime();
        }
        return this.api;
    };

    onReady = listener => {
        this.readyListeners.add(listener);
        if (this.api) listener(this.api);
        return () => this.readyListeners.delete(listener);
    };

    waitForApi = (timeoutMs = 15000) => {
        if (this.api) return Promise.resolve(this.api);
        return new Promise((resolve, reject) => {
            let timer;
            const unsubscribe = this.onReady(api => {
                if (timer) clearTimeout(timer);
                unsubscribe();
                resolve(api);
            });
            timer = setTimeout(() => {
                unsubscribe();
                reject(new Error('Shared Deriv connection is not ready'));
            }, timeoutMs);
        });
    };

    /**
     * Kept for compatibility with APIBase. It does not create a connection.
     */
    init = async () => {
        if (!this.api) {
            throw new Error('Shared Deriv connection is not ready');
        }
        this.getTime();
        return this.api;
    };

    getTime() {
        if (!this.api || this.time_interval) return;
        this.time_interval = setInterval(() => {
            if (this.api?.send) {
                this.api.send({ time: 1 }).catch?.(() => {});
            }
        }, 30000);
    };

    dispose() {
        if (this.time_interval) {
            clearInterval(this.time_interval);
            this.time_interval = null;
        }
        this.api = null;
    }
}

const chart_api = new ChartAPI();

export default chart_api;
