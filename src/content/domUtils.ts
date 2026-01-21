/**
 * DOM Utility Functions
 * Centralized DOM queries for YouTube elements
 */

// ============== Page Type Detection ==============

/**
 * Check if current page is a YouTube video page
 */
export function isVideoPage(): boolean {
    return window.location.pathname === '/watch';
}

/**
 * Check if current page is a playlist page
 */
export function isPlaylistPage(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has('list');
}

/**
 * Get video ID from current URL
 */
export function getVideoIdFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('v');
}

/**
 * Get playlist ID from current URL
 */
export function getPlaylistIdFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('list');
}

/**
 * Find YouTube's actions container (where buttons like Like, Share are)
 * Used for fallback toggle placement
 */
export function findActionsContainer(): Element | null {
    return (
        document.querySelector('#actions #actions-inner #menu') ||
        document.querySelector('#actions-inner #menu') ||
        document.querySelector('ytd-watch-metadata #actions') ||
        document.querySelector('#top-level-buttons-computed')
    );
}

/**
 * Find the YouTube masthead/branding area for Study Mode toggle placement
 * This should be below the YouTube logo on the left side
 */
export function findMastheadStart(): Element | null {
    return (
        // Main masthead start area (below YouTube logo)
        document.querySelector('ytd-masthead #start') ||
        document.querySelector('#masthead #start') ||
        // Fallback to the container area
        document.querySelector('ytd-masthead #container') ||
        document.querySelector('#masthead-container')
    );
}

/**
 * Find the Create button container in YouTube's header
 */
export function findCreateButtonContainer(): Element | null {
    return (
        document.querySelector('ytd-masthead #end ytd-button-renderer') ||
        document.querySelector('#buttons ytd-button-renderer')
    );
}

/**
 * Find YouTube's secondary panel (sidebar)
 */
export function findSidebar(): Element | null {
    return (
        document.querySelector('#secondary') ||
        document.querySelector('ytd-watch-flexy #secondary')
    );
}

/**
 * Find the playlist header element
 */
export function findPlaylistHeader(): Element | null {
    return (
        document.querySelector('ytd-playlist-panel-renderer #header-contents') ||
        document.querySelector('#playlist #header')
    );
}

/**
 * Find the playlist items container
 */
export function findPlaylistItemsContainer(): Element | null {
    return (
        document.querySelector('ytd-playlist-panel-renderer #items') ||
        document.querySelector('#playlist-items')
    );
}
