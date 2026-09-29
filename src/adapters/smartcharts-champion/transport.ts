/**
 * Transport wrapper around Apex Sentinel's single shared Deriv API instance.
 * This layer never initializes or creates a WebSocket.
 */
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import type { TTransport } from './types';

export function createTransport(): TTransport {
    const subscriptions = new Map<string, {
        request: any;
        callback: (response: any) => void;
        messageSubscription?: { unsubscribe: () => void };
        realSubscriptionId: string | null;
        lastMessageAt: number;
        binding: boolean;
        staleAfterMs: number;
    }>();

    const requireApi = () => {
        if (!chart_api.api?.send) throw new Error('Shared Deriv connection is not ready');
        return chart_api.api;
    };

    const bindSubscription = async (tempId: string, api: any) => {
        const stored = subscriptions.get(tempId);
        if (!stored || stored.binding) return;
        stored.binding = true;
        try {
            const oldSubscriptionId = stored.realSubscriptionId;
            stored.messageSubscription?.unsubscribe();
            stored.messageSubscription = undefined;
            stored.realSubscriptionId = null;

            // A silent stream can occur while the socket itself still reports OPEN.
            // Explicitly forget the old stream before replacing it so stale subscriptions
            // cannot accumulate on the shared WebSocket.
            if (oldSubscriptionId && api === chart_api.api) {
                try { await api.forget(oldSubscriptionId); } catch {}
            }

            stored.lastMessageAt = Date.now();
            stored.messageSubscription = api.onMessage()?.subscribe(({ data }: { data: any }) => {
                const current = subscriptions.get(tempId);
                const subscriptionId = data?.subscription?.id;
                if (!current || !subscriptionId || subscriptionId !== current.realSubscriptionId) return;
                current.lastMessageAt = Date.now();
                current.callback(data);
            });

            const response = await Promise.race([
                api.send(stored.request),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Deriv subscription request timed out')), 10000)),
            ]);
            const current = subscriptions.get(tempId);
            if (!current) return;
            const subscriptionId = response?.subscription?.id;
            if (!subscriptionId) throw new Error('Deriv did not return a subscription ID');
            current.realSubscriptionId = subscriptionId;
            current.lastMessageAt = Date.now();
            current.callback(response);
        } catch (error: any) {
            const current = subscriptions.get(tempId);
            current?.messageSubscription?.unsubscribe();
            if (current) current.messageSubscription = undefined;
            console.error('[SmartCharts Transport] Subscription failed:', error);
            // A request timeout while readyState is OPEN is a silent transport failure.
            // Closing the shared socket delegates recovery to APIBase's existing
            // exponential reconnect path rather than creating a second socket here.
            try {
                if (api.connection?.readyState === WebSocket.OPEN) api.connection.close();
            } catch {}
        } finally {
            const current = subscriptions.get(tempId);
            if (current) current.binding = false;
        }
    };

    let lastApi: any = null;
    const stopWatchingReconnects = chart_api.onReady((api: any) => {
        if (!api || api === lastApi) return;
        lastApi = api;
        for (const tempId of subscriptions.keys()) void bindSubscription(tempId, api);
    });

    // Deriv recommends detecting silent WebSocket failures, not only CLOSED sockets.
    // Tick streams should produce frequent updates on synthetic indices; if no message
    // arrives for 15s, rebuild that subscription on the same shared socket.
    const watchdog = window.setInterval(() => {
        const api = chart_api.api;
        if (!api?.send || api.connection?.readyState !== WebSocket.OPEN) return;
        const now = Date.now();
        for (const [tempId, subscription] of subscriptions) {
            if (subscription.binding || !subscription.realSubscriptionId) continue;
            if (now - subscription.lastMessageAt > subscription.staleAfterMs) {
                void bindSubscription(tempId, api);
            }
        }
    }, 5000);

    return {
        async send(request: any): Promise<any> {
            return requireApi().send(request);
        },

        subscribe(request: any, callback: (response: any) => void): string {
            const tempId = `smartchart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const subscribeRequest = { ...request, subscribe: 1 };
            const staleAfterMs = request?.granularity === 0
                ? 15000
                : Math.max(90000, Number(request?.granularity || 60) * 2000 + 10000);
            subscriptions.set(tempId, {
                request: subscribeRequest,
                callback,
                messageSubscription: undefined,
                realSubscriptionId: null,
                lastMessageAt: Date.now(),
                binding: false,
                staleAfterMs,
            });
            void bindSubscription(tempId, requireApi());
            return tempId;
        },

        unsubscribe(subscriptionId: string): void {
            const subscription = subscriptions.get(subscriptionId);
            if (!subscription) return;

            subscription.messageSubscription?.unsubscribe();
            if (chart_api.api && subscription.realSubscriptionId) {
                chart_api.api.forget(subscription.realSubscriptionId);
            }
            subscriptions.delete(subscriptionId);
        },

        unsubscribeAll(): void {
            for (const [id, subscription] of subscriptions) {
                subscription.messageSubscription?.unsubscribe();
                if (chart_api.api && subscription.realSubscriptionId) {
                    chart_api.api.forget(subscription.realSubscriptionId);
                }
                subscriptions.delete(id);
            }
            stopWatchingReconnects();
            window.clearInterval(watchdog);
        },
    };
}
