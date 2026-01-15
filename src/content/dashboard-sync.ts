/**
 * Dashboard Content Script
 * Runs on the Credlyse dashboard to sync auth tokens with the extension
 */

const STORAGE_KEY = 'credlyse_auth_token';
const USER_KEY = 'credlyse_user';

// Check for auth tokens in localStorage and sync to extension storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pollingInterval: any = null;

function syncAuthToExtension() {
    // Check if extension context is valid
    if (!chrome.runtime?.id) {
        if (pollingInterval) clearInterval(pollingInterval);
        return;
    }

    const token = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('access_token');
    const userStr = localStorage.getItem(USER_KEY);

    if (token) {
        let user = null;
        if (userStr) {
            try {
                user = JSON.parse(userStr);
            } catch (e) {
                console.error('[Credlyse Extension] Failed to parse user data');
            }
        }

        // Send to background service worker
        try {
            chrome.runtime.sendMessage({ type: 'SET_AUTH_TOKEN', token, user }, (response) => {
                if (chrome.runtime.lastError) {
                    // Suppress context invalidated error here too if it happens
                    if (chrome.runtime.lastError.message?.includes('context invalidated')) {
                        if (pollingInterval) clearInterval(pollingInterval);
                        return;
                    }
                    console.error('[Credlyse Extension] Failed to sync token:', chrome.runtime.lastError.message);
                } else if (response?.success) {
                    console.log('[Credlyse Extension] Token synced successfully from dashboard');
                }
            });
        } catch (e) {
            console.warn('[Credlyse Extension] Context invalidated, stopping sync.');
            if (pollingInterval) clearInterval(pollingInterval);
        }
    }
}

// Listen for storage changes
window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === 'access_token' || event.key === USER_KEY) {
        console.log('[Credlyse Extension] Storage changed, syncing...');
        syncAuthToExtension();
    }
});

// Check periodically for token updates
function startPolling() {
    syncAuthToExtension(); // Initial check

    // Poll every 2 seconds
    if (!pollingInterval) {
        pollingInterval = setInterval(syncAuthToExtension, 2000);
    }
}

// Also observe for access_token changes (what the dashboard actually uses)
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key: string, value: string) {
    originalSetItem(key, value);
    if (key === 'access_token' || key === STORAGE_KEY) {
        console.log('[Credlyse Extension] Token set in localStorage, syncing...');
        // Wait a bit for user data to be stored too
        setTimeout(syncAuthToExtension, 500);
    }
};

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPolling);
} else {
    startPolling();
}

console.log('[Credlyse Extension] Dashboard content script loaded');
