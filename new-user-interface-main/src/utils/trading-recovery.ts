import { api_base } from '@/external/bot-skeleton';

type TTradingRecoveryOptions = {
    forceReconnect?: boolean;
    source: string;
};

export const isTradingSocketOpen = () => api_base.api?.connection?.readyState === 1;

export const recoverTradingDataConnection = async ({ forceReconnect = false, source }: TTradingRecoveryOptions) => {
    const should_reconnect_socket = forceReconnect || !isTradingSocketOpen();

    if (!should_reconnect_socket) return;

    try {
        await api_base.init(true);
        await (api_base as any).authorizeAndSubscribe?.();
    } catch (error) {
        console.error(`[${source}] Trading data connection recovery failed:`, error);
        throw error;
    }
};
