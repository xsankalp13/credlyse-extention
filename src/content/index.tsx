import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { StudyModeToggle } from './StudyModeToggle';
import { ProgressPanel } from './ProgressPanel';
import { ProgressWheel } from './ProgressWheel';
import { PlaylistCompletedCounter } from './PlaylistCompletedCounter';
import { QuizPanel } from './QuizPanel';
import { VideoTracker, getVideoIdFromUrl } from './tracking';
import './styles.css';

// Container IDs
const CONTAINER_ID = 'youtube-study-mode-container';
const PROGRESS_CONTAINER_ID = 'youtube-study-progress-container';
const PROGRESS_WHEEL_ID = 'youtube-study-progress-wheel';
const PLAYLIST_COUNTER_ID = 'youtube-study-playlist-counter';
const QUIZ_CONTAINER_ID = 'youtube-study-quiz-container';

// Store for roots
let progressPanelRoot: Root | null = null;
let progressWheelRoot: Root | null = null;
let playlistCounterRoot: Root | null = null;
let quizPanelRoot: Root | null = null;

// Video tracker instance
let videoTracker: VideoTracker | null = null;
let currentVideoId: string | null = null;

// Initialize or reinitialize the video tracker
function initializeTracker(): void {
    const videoId = getVideoIdFromUrl();
    
    // Only initialize if study mode is active
    if (!document.body.classList.contains('youtube-study-mode-active')) {
        return;
    }

    // Skip if same video
    if (videoId === currentVideoId && videoTracker) {
        return;
    }

    // Destroy existing tracker if video changed
    if (videoTracker && videoId !== currentVideoId) {
        videoTracker.destroy();
        videoTracker = null;
    }

    // Create new tracker
    if (videoId && !videoTracker) {
        currentVideoId = videoId;
        videoTracker = new VideoTracker(videoId);
        console.log(`[Credlyse] Started tracking video: ${videoId}`);
    }
}

// Destroy the video tracker
function destroyTracker(): void {
    if (videoTracker) {
        videoTracker.destroy();
        videoTracker = null;
        currentVideoId = null;
    }
}

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
            // If we are on a playlist page but can't find the sidebar, retry
            // This prevents the panel from falling back to fixed positioning and overlapping
            setTimeout(injectProgressPanel, 500);
            return;
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

// Show quiz panel
function showQuizPanel(videoTitle: string): void {
    // Remove existing if any
    removeQuizPanel();

    const container = document.createElement('div');
    container.id = QUIZ_CONTAINER_ID;
    document.body.appendChild(container);

    quizPanelRoot = createRoot(container);
    quizPanelRoot.render(
        <React.StrictMode>
            <QuizPanel videoTitle={videoTitle} onClose={removeQuizPanel} />
        </React.StrictMode>
    );
}

// Remove quiz panel
function removeQuizPanel(): void {
    const container = document.getElementById(QUIZ_CONTAINER_ID);
    if (container) {
        if (quizPanelRoot) {
            quizPanelRoot.unmount();
            quizPanelRoot = null;
        }
        container.remove();
    }
}

// Inject quiz buttons into playlist items
function injectQuizButtons(): void {
    if (!isPlaylistPage()) return;
    if (!document.body.classList.contains('youtube-study-mode-active')) return;

    const playlistItems = document.querySelectorAll('ytd-playlist-panel-video-renderer');

    playlistItems.forEach((item) => {
        // Skip if already has quiz button
        if (item.querySelector('.study-quiz-btn')) return;

        const container = item.querySelector('#container');
        if (!container) return;

        // Get video title
        const titleEl = item.querySelector('#video-title');
        const videoTitle = titleEl?.textContent?.trim() || 'Video';

        // Create quiz button
        const quizBtn = document.createElement('button');
        quizBtn.className = 'study-quiz-btn';
        quizBtn.innerHTML = '<span class="study-quiz-btn-icon">📝</span> Quiz';
        quizBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            showQuizPanel(videoTitle);
        };

        container.appendChild(quizBtn);
    });
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

    // Inject quiz buttons into playlist items (with delay to ensure playlist loads)
    setTimeout(injectQuizButtons, 1000);
}

// Handle YouTube's SPA navigation
function handleNavigation(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const onNavigate = () => {
        setTimeout(() => {
            injectToggle();
            // Reinitialize tracker for new video (if study mode is active)
            initializeTracker();
        }, 100);
    };

    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        onNavigate();
    };

    history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        onNavigate();
    };

    window.addEventListener('popstate', onNavigate);
}

// Initialize
function init(): void {
    handleNavigation();
    injectToggle();

    // Listen for study mode toggle
    window.addEventListener('study-mode-toggled', ((e: CustomEvent) => {
        if (e.detail && e.detail.isEnabled) {
            // Give a small delay to ensure DOM updates
            setTimeout(() => {
                injectQuizButtons();
                setupPlaylistObserver();
                initializeTracker(); // Start video tracking
            }, 500);
        } else {
            disconnectPlaylistObserver();
            destroyTracker(); // Stop video tracking
        }
    }) as EventListener);

    // Initial check
    if (document.body.classList.contains('youtube-study-mode-active')) {
        setTimeout(() => {
            injectQuizButtons();
            setupPlaylistObserver();
            initializeTracker(); // Start video tracking
        }, 1000);
    }

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

// Playlist observer to handle infinite scroll/dynamic loading
let playlistObserver: MutationObserver | null = null;

function setupPlaylistObserver(): void {
    if (playlistObserver) return; // Already observing

    const playlistItemsContainer = document.querySelector('ytd-playlist-panel-renderer #items');
    if (!playlistItemsContainer) {
        // Retry if container not found yet
        setTimeout(setupPlaylistObserver, 1000);
        return;
    }

    playlistObserver = new MutationObserver((mutations) => {
        let shouldInject = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldInject = true;
                break;
            }
        }

        if (shouldInject) {
            injectQuizButtons();
        }
    });

    playlistObserver.observe(playlistItemsContainer, {
        childList: true,
        subtree: true
    });
}

function disconnectPlaylistObserver(): void {
    if (playlistObserver) {
        playlistObserver.disconnect();
        playlistObserver = null;
    }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

