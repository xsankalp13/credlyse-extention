import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { InjectionService } from './InjectionService';
import { NavigationService } from './NavigationService';
import { StudyModeToggle } from '../StudyModeToggle';
import { ProgressPanel } from '../ProgressPanel';
import { ProgressWheel } from '../ProgressWheel';
import { PlaylistCompletedCounter } from '../PlaylistCompletedCounter';
import { QuizPanel } from '../QuizPanel';
import { VideoTracker, getVideoIdFromUrl } from '../tracking';
import { getPlaylistIdFromUrl, type PlaylistStatus } from '../auth/authService';
import { clearSelectorCache, debounce } from '../utils';
import { applyFocusMode, removeFocusModeStyles } from '../configService';
import { isVideoPage, isPlaylistPage, findActionsContainer, findMastheadStart, findCreateButtonContainer, findPlaylistHeader, findPlaylistItemsContainer, findSidebar } from '../domUtils';

export class StudyModeManager {
    private injectionService = InjectionService.getInstance();
    private navigationService = NavigationService.getInstance();

    private roots: Map<string, Root> = new Map();
    private videoTracker: VideoTracker | null = null;
    private currentVideoId: string | null = null;
    private currentPlaylistStatus: PlaylistStatus | null = null;
    private playlistObserver: MutationObserver | null = null;
    private globalObserver: MutationObserver | null = null;

    constructor() {
        this.init();
    }

    private async init() {
        console.log('[Credlyse] Initializing StudyModeManager...');

        this.navigationService.onNavigate(() => this.handleNavigation());

        // Listen for study mode toggle event (from StudyModeToggle.tsx)
        window.addEventListener('study-mode-toggled', ((e: Event) => {
            const customEvent = e as CustomEvent;
            this.handleToggle(customEvent.detail?.isEnabled);
        }) as EventListener);

        // Listen for status updates
        window.addEventListener('playlist-status-updated', ((e: Event) => {
            const customEvent = e as CustomEvent;
            this.currentPlaylistStatus = customEvent.detail;
            this.injectQuizButtons();
        }) as EventListener);

        // Initial check
        this.handleNavigation();
        this.setupGlobalObserver();

        if (document.body.classList.contains('youtube-study-mode-active')) {
            await applyFocusMode();
            this.injectStudyModeComponents();
        }
    }

    private handleNavigation() {
        clearSelectorCache();
        this.injectToggle();

        if (document.body.classList.contains('youtube-study-mode-active')) {
            this.injectStudyModeComponents();
            this.initializeTracker();
        } else {
            this.destroyTracker();
            this.removeStudyModeComponents();
        }
    }

    private async handleToggle(isEnabled: boolean) {
        if (isEnabled) {
            await applyFocusMode();
            this.injectStudyModeComponents();
            this.initializeTracker();
            this.setupPlaylistObserver();
        } else {
            removeFocusModeStyles();
            this.removeStudyModeComponents();
            this.destroyTracker();
            this.disconnectPlaylistObserver();
        }
    }

    private injectToggle() {
        if (!isVideoPage()) {
            this.removeRoot(InjectionService.PROGRESS_CONTAINER_ID);
            return;
        }

        // Try masthead first (preferred location - below YouTube branding)
        const mastheadStart = findMastheadStart();
        if (mastheadStart) {
            const container = this.injectionService.createContainer(InjectionService.TOGGLE_CONTAINER_ID);
            mastheadStart.appendChild(container);
            this.renderComponent(InjectionService.TOGGLE_CONTAINER_ID, <StudyModeToggle />);
            return;
        }

        // Fallback to actions container (next to like/share buttons)
        const actionsContainer = findActionsContainer();
        if (!actionsContainer) {
            setTimeout(() => this.injectToggle(), 500);
            return;
        }

        const container = this.injectionService.createContainer(InjectionService.TOGGLE_CONTAINER_ID);
        actionsContainer.insertBefore(container, actionsContainer.firstChild);

        this.renderComponent(InjectionService.TOGGLE_CONTAINER_ID, <StudyModeToggle />);
    }

    private injectStudyModeComponents(retryCount = 0) {
        if (!isVideoPage()) return;

        console.log(`[Credlyse] Injecting Study Mode components... (attempt ${retryCount + 1})`);

        // Progress Panel - Always create and append to body first
        const existingContainer = document.getElementById(InjectionService.PROGRESS_CONTAINER_ID);
        if (!existingContainer) {
            const container = this.injectionService.createContainer(InjectionService.PROGRESS_CONTAINER_ID);

            // Force visibility with inline style
            container.style.display = 'block';

            if (isPlaylistPage()) {
                // In playlist mode, try to insert into sidebar after playlist panel
                const sidebar = findSidebar();
                const playlistPanel = sidebar?.querySelector('ytd-playlist-panel-renderer');

                if (playlistPanel) {
                    playlistPanel.insertAdjacentElement('afterend', container);
                    container.classList.add('playlist-mode');
                    console.log('[Credlyse] Progress Panel inserted after playlist panel');
                } else if (retryCount < 15) {
                    // Playlist panel not ready yet, retry with backoff
                    const delay = Math.min(200 * Math.pow(1.3, retryCount), 3000);
                    console.log(`[Credlyse] Playlist panel not found, retrying in ${delay}ms...`);
                    setTimeout(() => this.injectStudyModeComponents(retryCount + 1), delay);
                    return; // Don't continue until playlist panel is found
                } else if (sidebar) {
                    // After all retries, fallback to prepending to sidebar
                    sidebar.insertBefore(container, sidebar.firstChild);
                    container.classList.add('playlist-mode');
                    console.warn('[Credlyse] Progress Panel inserted at start of sidebar (playlist panel not found after retries)');
                } else {
                    // Ultimate fallback: append to body
                    document.body.appendChild(container);
                    console.warn('[Credlyse] Progress Panel appended to body (sidebar not found)');
                }
            } else {
                // Non-playlist: fixed position on right side
                document.body.appendChild(container);
                container.classList.remove('playlist-mode');
                console.log('[Credlyse] Progress Panel appended to body (non-playlist)');
            }

            this.renderComponent(InjectionService.PROGRESS_CONTAINER_ID, <ProgressPanel />);
        } else {
            // Ensure existing container is visible
            existingContainer.style.display = 'block';
            console.log('[Credlyse] Progress container already exists, ensuring visibility');
        }

        // Progress Wheel
        const createBtn = findCreateButtonContainer();
        if (createBtn) {
            const wheelContainer = this.injectionService.createContainer(InjectionService.PROGRESS_WHEEL_ID);
            createBtn.parentNode?.insertBefore(wheelContainer, createBtn);
            this.renderComponent(InjectionService.PROGRESS_WHEEL_ID, <ProgressWheel />);
        }

        // Playlist Counter
        if (isPlaylistPage()) {
            const playlistHeader = findPlaylistHeader();
            if (playlistHeader) {
                const counterContainer = this.injectionService.createContainer(InjectionService.PLAYLIST_COUNTER_ID);
                playlistHeader.appendChild(counterContainer);
                this.renderComponent(InjectionService.PLAYLIST_COUNTER_ID, <PlaylistCompletedCounter />);
            }
        }

        this.injectQuizButtons();
    }

    private removeStudyModeComponents() {
        this.removeRoot(InjectionService.PROGRESS_CONTAINER_ID);
        this.removeRoot(InjectionService.PROGRESS_WHEEL_ID);
        this.removeRoot(InjectionService.PLAYLIST_COUNTER_ID);
        this.removeRoot(InjectionService.QUIZ_CONTAINER_ID);

        document.querySelectorAll('.study-quiz-btn').forEach(btn => btn.remove());
    }

    private renderComponent(id: string, element: React.ReactElement) {
        const container = document.getElementById(id);
        if (!container) return;

        let root = this.roots.get(id);
        if (!root) {
            root = createRoot(container);
            this.roots.set(id, root);
        }

        root.render(<React.StrictMode>{element} </React.StrictMode>);
    }

    private removeRoot(id: string) {
        const root = this.roots.get(id);
        if (root) {
            root.unmount();
            this.roots.delete(id);
        }
        this.injectionService.removeContainer(id);
    }

    private initializeTracker() {
        const videoId = getVideoIdFromUrl();
        if (!document.body.classList.contains('youtube-study-mode-active')) return;
        if (videoId === this.currentVideoId && this.videoTracker) return;

        if (this.videoTracker) {
            this.videoTracker.destroy();
        }

        if (videoId) {
            this.currentVideoId = videoId;
            this.videoTracker = new VideoTracker(videoId);
            console.log(`[Credlyse] Tracker initialized for ${videoId}`);
        }
    }

    private destroyTracker() {
        if (this.videoTracker) {
            this.videoTracker.destroy();
            this.videoTracker = null;
            this.currentVideoId = null;
        }
    }

    private injectQuizButtons() {
        if (!isPlaylistPage() || !this.currentPlaylistStatus?.playlist_exists) return;

        const items = document.querySelectorAll('ytd-playlist-panel-video-renderer');
        items.forEach(item => {
            const anchor = item.querySelector('a#wc-endpoint') as HTMLAnchorElement;
            const videoId = new URL(anchor?.href || '', window.location.origin).searchParams.get('v');
            if (!videoId) return;

            const videoInfo = this.currentPlaylistStatus?.videos.find(v => v.youtube_video_id === videoId);
            if (!videoInfo?.has_quiz) {
                item.querySelector('.study-quiz-btn')?.remove();
                return;
            }

            if (item.querySelector('.study-quiz-btn')) return;

            const btn = document.createElement('button');
            btn.className = 'study-quiz-btn';
            btn.innerHTML = '<span class="study-quiz-btn-icon">📝</span> Quiz';

            const isEnrolled = this.currentPlaylistStatus?.is_enrolled;
            if (isEnrolled) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    this.showQuiz(videoInfo.title, videoInfo.id);
                };
            } else {
                btn.classList.add('disabled');
                btn.title = 'Enroll to take quiz';
            }

            const meta = item.querySelector('#meta') || item.querySelector('#container');
            meta?.appendChild(btn);
        });
    }

    private showQuiz(title: string, id: number) {
        const container = this.injectionService.createContainer(InjectionService.QUIZ_CONTAINER_ID);
        document.body.appendChild(container);
        this.renderComponent(InjectionService.QUIZ_CONTAINER_ID,
            <QuizPanel videoTitle={title} videoId={id} onClose={() => this.removeRoot(InjectionService.QUIZ_CONTAINER_ID)} />
        );
    }

    private setupGlobalObserver() {
        if (this.globalObserver) return;

        const debouncedCheck = debounce(() => {
            if (!document.getElementById(InjectionService.TOGGLE_CONTAINER_ID)) {
                this.injectToggle();
            }
        }, 500);

        this.globalObserver = new MutationObserver(() => debouncedCheck());
        this.globalObserver.observe(document.body, { childList: true, subtree: true });
    }

    private setupPlaylistObserver() {
        const container = findPlaylistItemsContainer();
        if (!container || this.playlistObserver) return;

        this.playlistObserver = new MutationObserver(() => this.injectQuizButtons());
        this.playlistObserver.observe(container, { childList: true });
    }

    private disconnectPlaylistObserver() {
        this.playlistObserver?.disconnect();
        this.playlistObserver = null;
    }
}
