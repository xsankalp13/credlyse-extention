import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { StudyModeToggle } from './StudyModeToggle';
import { ProgressPanel } from './ProgressPanel';
import { ProgressWheel } from './ProgressWheel';
import { PlaylistCompletedCounter } from './PlaylistCompletedCounter';
import './styles.css';

// Container IDs
const CONTAINER_ID = 'youtube-study-mode-container';
const PROGRESS_CONTAINER_ID = 'youtube-study-progress-container';
const PROGRESS_WHEEL_ID = 'youtube-study-progress-wheel';
const PLAYLIST_COUNTER_ID = 'youtube-study-playlist-counter';

// Store for roots
let progressPanelRoot: Root | null = null;
let progressWheelRoot: Root | null = null;
let playlistCounterRoot: Root | null = null;

// Check if we're on a video watch page
function isVideoPage(): boolean {
    return window.location.pathname === '/watch';
}

// Find the actions container (where like button is)
function findActionsContainer(): Element | null {
    return (
        document.querySelector('#actions ytd-menu-renderer') ||
        document.querySelector('#top-level-buttons-computed') ||
        document.querySelector('ytd-watch-metadata #actions') ||
        document.querySelector('#menu-container')
    );
}

// Find the Create button container in the header
function findCreateButtonContainer(): Element | null {
    return (
        document.querySelector('ytd-topbar-menu-button-renderer[button-renderer]') ||
        document.querySelector('#buttons ytd-topbar-menu-button-renderer') ||
        document.querySelector('ytd-masthead #end #buttons')
    );
}

// Inject progress wheel in navbar
function injectProgressWheel(): void {
    const existing = document.getElementById(PROGRESS_WHEEL_ID);
    if (existing) {
        return; // Already exists
    }

    if (!isVideoPage()) {
        return;
    }

    const createBtn = findCreateButtonContainer();
    if (!createBtn) {
        setTimeout(injectProgressWheel, 500);
        return;
    }

    const container = document.createElement('div');
    container.id = PROGRESS_WHEEL_ID;

    // Insert before the Create button
    createBtn.parentNode?.insertBefore(container, createBtn);

    progressWheelRoot = createRoot(container);
    progressWheelRoot.render(
        <React.StrictMode>
            <ProgressWheel />
        </React.StrictMode>
    );
}

// Remove progress wheel
function removeProgressWheel(): void {
    const container = document.getElementById(PROGRESS_WHEEL_ID);
    if (container) {
        if (progressWheelRoot) {
            progressWheelRoot.unmount();
            progressWheelRoot = null;
        }
        container.remove();
    }
}

// Check if we're on a playlist
function isPlaylistPage(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('list');
}

// Inject progress panel - different positioning for playlist vs single video
function injectProgressPanel(): void {
    const existing = document.getElementById(PROGRESS_CONTAINER_ID);
    if (existing) {
        return; // Already exists
    }

    if (!isVideoPage()) {
        return;
    }

    const container = document.createElement('div');
    container.id = PROGRESS_CONTAINER_ID;

    if (isPlaylistPage()) {
        // For playlist, inject into the secondary/sidebar area after the playlist
        const sidebar = document.querySelector('#secondary-inner') ||
            document.querySelector('#secondary') ||
            document.querySelector('ytd-playlist-panel-renderer');
        if (sidebar) {
            sidebar.appendChild(container);
            container.classList.add('playlist-mode');
        } else {
            // Fallback to body if sidebar not found
            document.body.appendChild(container);
        }
    } else {
        // For single video, append to body with fixed positioning
        document.body.appendChild(container);
    }

    progressPanelRoot = createRoot(container);
    progressPanelRoot.render(
        <React.StrictMode>
            <ProgressPanel />
        </React.StrictMode>

    );

    // Also inject playlist counter if on playlist
    if (isPlaylistPage()) {
        injectPlaylistCounter();
    }
}

// Inject playlist completed counter into playlist header
function injectPlaylistCounter(): void {
    const existing = document.getElementById(PLAYLIST_COUNTER_ID);
    if (existing) {
        return;
    }

    const playlistHeader = document.querySelector('ytd-playlist-panel-renderer #header #top-level-buttons') ||
        document.querySelector('ytd-playlist-panel-renderer #header') ||
        document.querySelector('ytd-playlist-panel-renderer #publisher-container');

    if (!playlistHeader) {
        setTimeout(injectPlaylistCounter, 500);
        return;
    }

    const container = document.createElement('div');
    container.id = PLAYLIST_COUNTER_ID;

    // Insert after publisher container or at the start
    const publisherContainer = playlistHeader.querySelector('#publisher-container');
    if (publisherContainer && publisherContainer.parentNode) {
        publisherContainer.parentNode.insertBefore(container, publisherContainer.nextSibling);
    } else {
        playlistHeader.appendChild(container);
    }

    playlistCounterRoot = createRoot(container);
    playlistCounterRoot.render(
        <React.StrictMode>
            <PlaylistCompletedCounter />
        </React.StrictMode>
    );
}

// Remove playlist counter
function removePlaylistCounter(): void {
    const container = document.getElementById(PLAYLIST_COUNTER_ID);
    if (container) {
        if (playlistCounterRoot) {
            playlistCounterRoot.unmount();
            playlistCounterRoot = null;
        }
        container.remove();
    }
}

// Remove progress panel
function removeProgressPanel(): void {
    const container = document.getElementById(PROGRESS_CONTAINER_ID);
    if (container) {
        if (progressPanelRoot) {
            progressPanelRoot.unmount();
            progressPanelRoot = null;
        }
        container.remove();
    }
    // Also remove progress wheel and playlist counter
    removeProgressWheel();
    removePlaylistCounter();
}

// Create and inject the toggle container
function injectToggle(): void {
    const existing = document.getElementById(CONTAINER_ID);
    if (existing) {
        existing.remove();
    }

    if (!isVideoPage()) {
        removeProgressPanel();
        return;
    }

    const actionsContainer = findActionsContainer();
    if (!actionsContainer) {
        setTimeout(injectToggle, 500);
        return;
    }

    const container = document.createElement('div');
    container.id = CONTAINER_ID;

    // Insert before the first child (left of like button)
    actionsContainer.insertBefore(container, actionsContainer.firstChild);

    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <StudyModeToggle />
        </React.StrictMode>
    );

    // Also inject progress panel and wheel
    injectProgressPanel();
    injectProgressWheel();
}

// Handle YouTube's SPA navigation
function handleNavigation(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        setTimeout(injectToggle, 100);
    };

    history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        setTimeout(injectToggle, 100);
    };

    window.addEventListener('popstate', () => {
        setTimeout(injectToggle, 100);
    });
}

// Initialize
function init(): void {
    handleNavigation();
    injectToggle();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                const container = document.getElementById(CONTAINER_ID);
                if (isVideoPage() && !container) {
                    injectToggle();
                    break;
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

