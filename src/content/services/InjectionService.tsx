/**
 * InjectionService - Manages DOM container creation and cleanup
 */

export class InjectionService {
    private static instance: InjectionService;

    // Root IDs
    static readonly TOGGLE_CONTAINER_ID = 'youtube-study-mode-container';
    static readonly PROGRESS_CONTAINER_ID = 'youtube-study-progress-container';
    static readonly PROGRESS_WHEEL_ID = 'youtube-study-progress-wheel';
    static readonly PLAYLIST_COUNTER_ID = 'youtube-study-playlist-counter';
    static readonly QUIZ_CONTAINER_ID = 'youtube-study-quiz-container';

    private constructor() { }

    static getInstance(): InjectionService {
        if (!InjectionService.instance) {
            InjectionService.instance = new InjectionService();
        }
        return InjectionService.instance;
    }

    createContainer(id: string, className?: string): HTMLElement {
        const existing = document.getElementById(id);
        if (existing) {
            return existing;
        }
        const container = document.createElement('div');
        container.id = id;
        if (className) container.className = className;
        return container;
    }

    removeContainer(id: string): void {
        const container = document.getElementById(id);
        if (container) {
            container.remove();
        }
    }
}
