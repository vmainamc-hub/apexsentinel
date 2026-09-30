import { useEffect, useState } from 'react';
import { useStore } from './useStore';

/**
 * Custom hook to sync localStorage changes across tabs
 * Specifically monitors 'session_token' changes from other tabs and refreshes the page
 *
 * How it works:
 * - The 'storage' event only fires on other tabs/windows when localStorage is modified
 * - It does NOT fire on the tab that made the change
 * - This is perfect for detecting session token changes from other tabs
 * - If bot is running, shows a modal instead of immediate reload
 * - Temporarily disables beforeunload prompt to avoid Chrome's native dialog
 *
 * Usage:
 * - Import and call this hook in your main App component
 * - When another tab changes the session_token, this tab will automatically refresh or show modal
 * - Changes made by the current tab will not trigger a refresh
 */
export const useLocalStorageSync = () => {
    const store = useStore();
    const [showAccountChangeModal, setShowAccountChangeModal] = useState(false);

    const handleReload = () => {
        // Temporarily disable prompt handler during refresh to prevent Chrome's native dialog
        if (store?.ui?.setPromptHandler) {
            store.ui.setPromptHandler(false);
        }

        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    const handleModalClose = () => {
        setShowAccountChangeModal(false);
    };

    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            // Account identifiers are non-secret and synchronize selection across tabs.
            if (event.key !== 'active_loginid') {
                return;
            }

            // Check if bot is running
            const isBotRunning = store?.run_panel?.is_running;

            if (isBotRunning) {
                setShowAccountChangeModal(true);
            } else {
                handleReload();
            }
        };

        // Listen for localStorage changes from other tabs
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [store?.run_panel?.is_running, store?.ui]);

    return {
        showAccountChangeModal,
        handleReload,
        handleModalClose,
    };
};
