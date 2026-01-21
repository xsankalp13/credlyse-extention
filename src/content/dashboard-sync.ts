/**
 * Dashboard Content Script
 * Runs on the Credlyse dashboard to sync auth tokens with the extension
 */

const STORAGE_KEY = 'credlyse_auth_token';
const USER_KEY = 'credlyse_user';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pollingInterval: any = null;
let lastSyncedToken: string | null = null;

function syncAuthToExtension(verbose = false) {
    // Check if extension context is valid
    if (!chrome.runtime?.id) {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        return;
    }

    const token = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('access_token');
    const userStr = localStorage.getItem(USER_KEY);

    // Skip if token hasn't changed (avoid spam)
    if (token === lastSyncedToken && !verbose) {
        return;
    }

    if (token) {
        let user = null;
        if (userStr) {
            try {
                user = JSON.parse(userStr);
            } catch (e) {
                // Silently ignore parse errors
            }
        }

        // Send to background service worker
        try {
            chrome.runtime.sendMessage({ type: 'SET_AUTH_TOKEN', token, user }, (response) => {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message?.includes('context invalidated')) {
                        if (pollingInterval) {
                            clearInterval(pollingInterval);
                            pollingInterval = null;
                        }
                        return;
                    }
                } else if (response?.success && token !== lastSyncedToken) {
                    console.log('[Credlyse Extension] ✅ Token synced from dashboard');
                    lastSyncedToken = token;
                }
            });
        } catch (e) {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        }
    } else if (lastSyncedToken !== null) {
        // Token was removed (logout)
        console.log('[Credlyse Extension] Token removed, user logged out');
        chrome.runtime.sendMessage({ type: 'LOGOUT' });
        lastSyncedToken = null;
    }
}

// Listen for storage changes (fires for cross-tab changes)
window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === 'access_token' || event.key === USER_KEY) {
        syncAuthToExtension(true);
    }
});

// Start polling
function startPolling() {
    syncAuthToExtension(true); // Initial check with verbose

    // Poll every 2 seconds (silent unless token changes)
    if (!pollingInterval) {
        pollingInterval = setInterval(() => syncAuthToExtension(false), 2000);
    }
}

// Intercept localStorage.setItem for immediate sync on login
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key: string, value: string) {
    originalSetItem(key, value);
    if (key === 'access_token' || key === STORAGE_KEY || key === USER_KEY) {
        setTimeout(() => syncAuthToExtension(true), 500);
    }
};

// Add this immediately after the existing localStorage.setItem override

const originalRemoveItem = localStorage.removeItem.bind(localStorage);
localStorage.removeItem = function (key: string) {
    originalRemoveItem(key);
    if (key === 'access_token' || key === 'credlyse_auth_token' || key === 'credlyse_user') {
        // Trigger sync immediately to handle logout
        setTimeout(() => syncAuthToExtension(true), 50);
    }
};

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPolling);
} else {
    startPolling();
}

console.log('[Credlyse Extension] Dashboard sync loaded');
