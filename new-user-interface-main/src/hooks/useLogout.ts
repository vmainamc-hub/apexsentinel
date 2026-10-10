import { useCallback } from 'react';
import { useStore } from '@/hooks/useStore';
import { ErrorLogger } from '@/utils/error-logger';

// Only auth-related keys are cleared. There is deliberately no "wipe all storage" fallback:
// localStorage also holds unrelated user data (saved bots, settings) that must survive a logout.
const AUTH_SESSION_STORAGE_KEYS = [
    'auth_info',
    'oauth_code_verifier',
    'oauth_csrf_token',
    'oauth_site_id',
    'oauth_redirect_uri',
];

const AUTH_LOCAL_STORAGE_KEYS = [
    'active_loginid',
    'authToken',
    'accountsList',
    'clientAccounts',
    'account_type',
    'auth_info',
    'deriv_accounts',
    'client_account_details',
    'client.country',
];

const clearPersistedAuthStorage = () => {
    try {
        AUTH_SESSION_STORAGE_KEYS.forEach(key => sessionStorage.removeItem(key));
        AUTH_LOCAL_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    } catch (storageError) {
        // Log and swallow: logout must never throw, and we never fall back to clearing everything.
        ErrorLogger.error('Logout', 'Failed to clear persisted auth storage', storageError);
    }
};

/**
 * Custom hook to handle logout functionality
 * Calls the client store logout, then clears only auth-related storage keys so
 * user preferences (theme, language, saved bots, etc.) are preserved.
 * @returns {Function} handleLogout - Function to trigger the logout process
 */
export const useLogout = () => {
    const { client } = useStore() ?? {};

    return useCallback(async () => {
        try {
            await client?.logout();
            // Analytics.reset() removed - Analytics package has been removed from the project
            // See migrate-docs/MONITORING_PACKAGES.md for re-enabling analytics if needed
        } catch (error) {
            ErrorLogger.error('Logout', 'Logout request failed; clearing local session anyway', error);
        }
        clearPersistedAuthStorage();
    }, [client]);
};
