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
    }>();

    const requireApi = () => {
        if (!chart_api.api?.send) throw new Error('Shared Deriv connection is not ready');
        return chart_api.api;
    };

    const bindSubscription = (tempId: string, api: any) => {
        const stored = subscriptions.get(tempId);
        if (!stored) return;
        stored.messageSubscription?.unsubscribe();
        stored.realSubscriptionId = null;
        stored.messageSubscription = api.onMessage()?.subscribe(({ data }: { data: any }) => {
            const s = subscriptions.get(tempId);
            const subscriptionId = data?.subscription?.id;
            if (!s || !subscriptionId || subscriptionId !== s.realSubscriptionId) return;
            s.callback(data);
        });
        api.send(stored.request)
            .then((response: any) => {
                const s = subscriptions.get(tempId);
                if (!s) return;
                const subscriptionId = response?.subscription?.id;
                if (!subscriptionId) throw new Error('Deriv did not return a subscription ID');
                s.realSubscriptionId = subscriptionId;
                s.callback(response);
            })
            .catch((error: any) => {
                subscriptions.get(tempId)?.messageSubscription?.unsubscribe();
                subscriptions.delete(tempId);
                console.error('[SmartCharts Transport] Subscription failed:', error);
            });
    };

    let lastApi: any = null;
    const stopWatchingReconnects = chart_api.onReady((api: any) => {
        if (!api || api === lastApi) return;
        lastApi = api;
        for (const tempId of subscriptions.keys()) bindSubscription(tempId, api);
    });

    return {
        async send(request: any): Promise<any> {
            return requireApi().send(request);
        },

        subscribe(request: any, callback: (response: any) => void): string {
            const tempId = `smartchart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const subscribeRequest = { ...request, subscribe: 1 };
            subscriptions.set(tempId, { request: subscribeRequest, callback, messageSubscription: undefined, realSubscriptionId: null });
            bindSubscription(tempId, requireApi());
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
        },
    };
}
