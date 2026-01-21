export class NavigationService {
    private static instance: NavigationService;
    private listeners: Set<() => void> = new Set();

    private constructor() {
        this.setupNavigationListeners();
    }

    static getInstance(): NavigationService {
        if (!NavigationService.instance) {
            NavigationService.instance = new NavigationService();
        }
        return NavigationService.instance;
    }

    private setupNavigationListeners(): void {
        // Handle YouTube's SPA navigation events
        document.addEventListener('yt-navigate-finish', () => {
            console.log('[Credlyse] yt-navigate-finish');
            this.notify();
        });

        // Fallback for standard popstate
        window.addEventListener('popstate', () => {
            console.log('[Credlyse] popstate');
            this.notify();
        });

        // Intercept pushState/replaceState
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = (...args: any[]) => {
            originalPushState.apply(history, args);
            this.notify();
        };

        history.replaceState = (...args: any[]) => {
            originalReplaceState.apply(history, args);
            this.notify();
        };
    }

    onNavigate(callback: () => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notify(): void {
        // Use a small delay to let YouTube update the DOM
        setTimeout(() => {
            this.listeners.forEach(cb => cb());
        }, 100);
    }
}
