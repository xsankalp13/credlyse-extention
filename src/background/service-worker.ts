/**
 * Background Service Worker for YouTube Study Mode Extension
 * 
 * Handles:
 * - Auth token received from dashboard app via message passing
 * - Periodic token validation
 * - Cross-tab auth state synchronization
 */

const API_BASE_URL = 'http://localhost:8000';

// Listen for messages from dashboard app or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_AUTH_TOKEN') {
        // Receive token from dashboard app
        handleSetAuthToken(message.token, message.user)
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }

    if (message.type === 'GET_AUTH_STATE') {
        getAuthState()
            .then((state) => sendResponse(state))
            .catch(() => sendResponse({ isAuthenticated: false, user: null, token: null }));
        return true;
    }

    if (message.type === 'LOGOUT') {
        chrome.storage.local.remove(['access_token', 'user'], () => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.type === 'VALIDATE_TOKEN') {
        validateToken()
            .then((isValid) => sendResponse({ isValid }))
            .catch(() => sendResponse({ isValid: false }));
        return true;
    }
    if (message.type === 'PROXY_API_REQUEST') {
        const { endpoint, options } = message;
        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

        console.log('[Credlyse SW] Proxying request to:', url);

        fetch(url, options)
            .then(async (response) => {
                let data = null;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json().catch(() => null);
                } else {
                    data = await response.text().catch(() => null);
                }

                sendResponse({
                    success: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    data
                });
            })
            .catch((error) => {
                console.error('[Credlyse SW] Proxy fetch error:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
});

// Listen for external connections from the dashboard app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (sender.url?.startsWith('http://localhost:3001') ||
        sender.url?.startsWith('https://app.credlyse.com')) {
        if (message.type === 'SET_AUTH_TOKEN') {
            handleSetAuthToken(message.token, message.user)
                .then(() => sendResponse({ success: true }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }
    }
});

async function handleSetAuthToken(token: string, user: any): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ access_token: token, user }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                console.log('[Credlyse] Auth token stored from dashboard');
                resolve();
            }
        });
    });
}

async function getAuthState(): Promise<{ isAuthenticated: boolean; user: any; token: string | null }> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['access_token', 'user'], (result) => {
            resolve({
                isAuthenticated: !!result.access_token,
                user: result.user || null,
                token: result.access_token || null,
            });
        });
    });
}

async function validateToken(): Promise<boolean> {
    const { token } = await getAuthState();
    if (!token) return false;

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        return response.ok;
    } catch {
        return false;
    }
}

// Periodic token validation (every 30 minutes)
chrome.alarms.create('validateToken', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'validateToken') {
        const isValid = await validateToken();
        if (!isValid) {
            // Token expired, clear auth state
            chrome.storage.local.remove(['access_token', 'user']);
            console.log('[Credlyse] Token expired, cleared auth state');
        }
    }
});

console.log('[Credlyse] Background service worker initialized');

// Validate token immediately on startup
validateToken().then((isValid) => {
    if (!isValid) {
        chrome.storage.local.get(['access_token'], (result) => {
            if (result.access_token) {
                console.log('[Credlyse] Token invalid on startup, clearing auth state');
                chrome.storage.local.remove(['access_token', 'user']);
            }
        });
    }
});
