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

    return {
        async send(request: any): Promise<any> {
            return requireApi().send(request);
        },

        subscribe(request: any, callback: (response: any) => void): string {
            const api = requireApi();
            const tempId = `smartchart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const subscribeRequest = { ...request, subscribe: 1 };

            const messageSubscription = api.onMessage()?.subscribe(({ data }: { data: any }) => {
                const stored = subscriptions.get(tempId);
                const subscriptionId = data?.subscription?.id;
                if (!stored || !subscriptionId || subscriptionId !== stored.realSubscriptionId) return;
                callback(data);
            });

            subscriptions.set(tempId, {
                request: subscribeRequest,
                callback,
                messageSubscription,
                realSubscriptionId: null,
            });

            api.send(subscribeRequest)
                .then((response: any) => {
                    const stored = subscriptions.get(tempId);
                    if (!stored) return;
                    const subscriptionId = response?.subscription?.id;
                    if (!subscriptionId) throw new Error('Deriv did not return a subscription ID');
                    stored.realSubscriptionId = subscriptionId;
                    subscriptions.set(tempId, stored);
                    callback(response);
                })
                .catch(error => {
                    subscriptions.get(tempId)?.messageSubscription?.unsubscribe();
                    subscriptions.delete(tempId);
                    console.error('[SmartCharts Transport] Subscription failed:', error);
                });

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
        },
    };
}
