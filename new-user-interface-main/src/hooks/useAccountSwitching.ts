import { useEffect } from 'react';
import { crypto_currencies_display_order, fiat_currencies_display_order } from '@/components/shared';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';

/** Selects a non-secret account identifier from the optional `account` URL hint. */
export const useAccountSwitching = () => {
    useEffect(() => {
        const requested = new URLSearchParams(window.location.search).get('account')?.toUpperCase();
        if (!requested) return;
        const supported = [...fiat_currencies_display_order, ...crypto_currencies_display_order];
        const accounts = DerivWSAccountsService.getStoredAccounts() || [];
        const selected =
            requested === 'DEMO'
                ? accounts.find(account => account.account_type === 'demo')
                : supported.includes(requested)
                  ? accounts.find(account => account.account_type === 'real' && account.currency.toUpperCase() === requested)
                  : undefined;
        if (selected) {
            localStorage.setItem('active_loginid', selected.account_id);
            localStorage.setItem('account_type', selected.account_type);
        }
    }, []);
};
