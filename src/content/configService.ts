/**
 * Remote Configuration Service for YouTube Study Mode
 * 
 * Handles fetching, caching, and applying CSS selectors from the backend.
 * This enables "hotfixes" - updating selectors without waiting for
 * Chrome Web Store approval (48h).
 * 
 * CACHING STRATEGY:
 * 1. Check chrome.storage.local for cached config
 * 2. If cache valid (< 24 hours old) → use cache
 * 3. Else fetch from API
 *    - Success → cache response + use it
 *    - Failure → use HARDCODED_FALLBACK selectors
 */

// ============== Types ==============

export interface YouTubeSelectors {
    sidebar: string;
    comments: string;
    end_screen: string;
    version: string;
}

interface CachedConfig {
    selectors: YouTubeSelectors;
    timestamp: number;  // Unix timestamp in ms
}

// ============== Constants ==============

const API_BASE_URL = 'http://127.0.0.1:8000';  // eslint-disable-line @typescript-eslint/no-unused-vars
const CONFIG_ENDPOINT = '/api/v1/config/youtube';
const CACHE_KEY = 'credlyse_youtube_config';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const STYLE_TAG_ID = 'credlyse-focus-mode-styles';

/**
 * HARDCODED FALLBACK SELECTORS
 * 
 * Used when:
 * - API is down
 * - Backend unreachable
 * - Network error
 * 
 * IMPORTANT: Keep these updated as a last resort!
 */
const HARDCODED_FALLBACK: YouTubeSelectors = {
    // IMPORTANT: Do NOT hide #secondary itself - our Progress Panel is injected there!
    // Only hide the content inside the sidebar (related videos, recommendations)
    // Using specific child selectors to target content but not the container
    sidebar: '#secondary ytd-watch-next-secondary-results-renderer, #secondary #related, #secondary ytd-compact-video-renderer, #secondary ytd-compact-playlist-renderer, #secondary ytd-compact-radio-renderer',
    comments: '#comments, ytd-comments, ytd-comment-thread-renderer',
    end_screen: '.ytp-ce-element, .ytp-endscreen-content, .ytp-ce-covering-overlay',
    version: '1.2.0-opacity',
};

// ============== Cache Helpers ==============

/**
 * Check if cached config is still valid (within TTL)
 */
function isCacheValid(cached: CachedConfig | null): boolean {
    if (!cached) return false;
    const age = Date.now() - cached.timestamp;
    return age < CACHE_TTL_MS;
}

/**
 * Get cached config from chrome.storage.local
 */
async function getCachedConfig(): Promise<CachedConfig | null> {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage) {
            resolve(null);
            return;
        }

        chrome.storage.local.get([CACHE_KEY], (result) => {
            if (chrome.runtime.lastError) {
                console.warn('[Config] Cache read error:', chrome.runtime.lastError);
                resolve(null);
                return;
            }
            resolve(result[CACHE_KEY] || null);
        });
    });
}

/**
 * Save config to chrome.storage.local with timestamp
 */
async function setCachedConfig(selectors: YouTubeSelectors): Promise<void> {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage) {
            resolve();
            return;
        }

        const cached: CachedConfig = {
            selectors,
            timestamp: Date.now(),
        };

        chrome.storage.local.set({ [CACHE_KEY]: cached }, () => {
            if (chrome.runtime.lastError) {
                console.warn('[Config] Cache write error:', chrome.runtime.lastError);
            }
            resolve();
        });
    });
}

// ============== API Fetching ==============

/**
 * Fetch config from backend API
 * 
 * Goes through background script proxy to avoid CORS issues.
 */
async function fetchFromAPI(): Promise<YouTubeSelectors | null> {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            resolve(null);
            return;
        }

        chrome.runtime.sendMessage(
            {
                type: 'PROXY_API_REQUEST',
                endpoint: CONFIG_ENDPOINT,
                options: { method: 'GET' },
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[Config] API proxy error:', chrome.runtime.lastError);
                    resolve(null);
                    return;
                }

                if (!response || !response.success) {
                    console.warn('[Config] API request failed:', response?.status);
                    resolve(null);
                    return;
                }

                resolve(response.data as YouTubeSelectors);
            }
        );
    });
}

// ============== Main Export Functions ==============

/**
 * Get YouTube selectors with caching and fallback.
 * 
 * Logic:
 * 1. Check cache, use if valid
 * 2. Fetch from API if cache expired
 * 3. Fallback to hardcoded if API fails
 */
export async function getYouTubeSelectors(): Promise<YouTubeSelectors> {
    console.log('[Config] Getting YouTube selectors...');

    // Step 1: Check cache
    const cached = await getCachedConfig();
    if (isCacheValid(cached)) {
        console.log('[Config] Using cached config (version:', cached!.selectors.version + ')');
        return cached!.selectors;
    }

    // Step 2: Fetch from API
    console.log('[Config] Cache expired/missing, fetching from API...');
    const apiSelectors = await fetchFromAPI();

    if (apiSelectors) {
        console.log('[Config] Got fresh config from API (version:', apiSelectors.version + ')');
        await setCachedConfig(apiSelectors);
        return apiSelectors;
    }

    // Step 3: Fallback to hardcoded (API DOWN SCENARIO)
    console.warn('[Config] API unavailable, using HARDCODED FALLBACK selectors');

    // If we have an expired cache, still better than pure fallback
    if (cached) {
        console.log('[Config] Using expired cache as better-than-nothing fallback');
        return cached.selectors;
    }

    return HARDCODED_FALLBACK;
}

/**
 * Force refresh config from API (ignores cache)
 */
export async function refreshConfig(): Promise<YouTubeSelectors> {
    const apiSelectors = await fetchFromAPI();

    if (apiSelectors) {
        await setCachedConfig(apiSelectors);
        return apiSelectors;
    }

    return HARDCODED_FALLBACK;
}

// ============== Style Injection ==============

/**
 * Inject CSS to hide YouTube elements.
 * 
 * IMPORTANT: Uses style injection instead of element.remove()
 * This prevents "layout shift" and flickering.
 */
export function injectFocusModeStyles(selectors: YouTubeSelectors): void {
    // Remove existing style tag if present
    const existing = document.getElementById(STYLE_TAG_ID);
    if (existing) {
        existing.remove();
    }

    // Create new style tag
    const style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    style.textContent = `
        /* Credlyse Focus Mode - Dynamic Selectors */
        /* Version: ${selectors.version} */
        
        /* Hide sidebar/recommendations - using opacity to preserve layout */
        /* This keeps #secondary visible for our injected Progress Panel */
        ${selectors.sidebar} {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            height: 0 !important;
            overflow: hidden !important;
        }
        
        /* Ensure our progress panel container remains visible */
        #youtube-study-progress-container {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
            height: auto !important;
            overflow: visible !important;
        }
        
        /* Keep #secondary visible as the container - MUST OVERRIDE CACHED CONFIG */
        /* Cached v1.0.0 applies height:0 and overflow:hidden, so we need all these */
        #secondary,
        #secondary-inner {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            height: auto !important;
            overflow: visible !important;
            width: 402px !important;
            min-width: 300px !important;
            max-height: none !important;
            pointer-events: auto !important;
        }
        
        /* Hide comments section */
        ${selectors.comments} {
            opacity: 0 !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }
        
        /* Hide end screen overlays */
        ${selectors.end_screen} {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
    `;

    // Inject into head
    document.head.appendChild(style);
    console.log('[Config] Focus mode styles injected (version:', selectors.version + ')');
}

/**
 * Remove focus mode styles (for toggle off)
 */
export function removeFocusModeStyles(): void {
    const existing = document.getElementById(STYLE_TAG_ID);
    if (existing) {
        existing.remove();
        console.log('[Config] Focus mode styles removed');
    }
}

// ============== Main Entry Point ==============

/**
 * Apply focus mode with dynamic selectors.
 * 
 * This is the main function to call when enabling Study Mode.
 */
export async function applyFocusMode(): Promise<void> {
    const selectors = await getYouTubeSelectors();
    injectFocusModeStyles(selectors);
}
