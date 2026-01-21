/**
 * Utility Functions for YouTube Study Mode Extension
 * 
 * Performance utilities: debounce, throttle, memoized selectors
 */

/**
 * Debounce function - delays execution until after wait period of inactivity
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: unknown, ...args: Parameters<T>): void {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * Throttle function - limits execution to at most once per limit period
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    let lastArgs: Parameters<T> | null = null;

    return function (this: unknown, ...args: Parameters<T>): void {
        if (inThrottle) {
            // Store latest args for trailing call
            lastArgs = args;
            return;
        }

        fn.apply(this, args);
        inThrottle = true;

        setTimeout(() => {
            inThrottle = false;
            // Execute trailing call with latest args
            if (lastArgs) {
                fn.apply(this, lastArgs);
                lastArgs = null;
            }
        }, limit);
    };
}

/**
 * Memoized querySelector with TTL cache
 * Caches DOM elements to avoid repeated queries
 */
const selectorCache = new Map<string, { element: Element | null; expires: number }>();
const SELECTOR_CACHE_TTL = 2000; // 2 seconds

export function memoizedQuerySelector<T extends Element>(
    selector: string,
    forceRefresh = false
): T | null {
    const now = Date.now();
    const cached = selectorCache.get(selector);

    if (!forceRefresh && cached && cached.expires > now && cached.element?.isConnected) {
        return cached.element as T;
    }

    const element = document.querySelector<T>(selector);
    selectorCache.set(selector, { element, expires: now + SELECTOR_CACHE_TTL });

    return element;
}

/**
 * Clear stale entries from selector cache
 */
export function clearSelectorCache(): void {
    const now = Date.now();
    for (const [key, value] of selectorCache.entries()) {
        if (value.expires < now || !value.element?.isConnected) {
            selectorCache.delete(key);
        }
    }
}

/**
 * Request deduplication - prevents duplicate concurrent requests
 */
const pendingRequests = new Map<string, Promise<unknown>>();

export async function deduplicatedRequest<T>(
    key: string,
    requestFn: () => Promise<T>
): Promise<T> {
    // Check if request is already in flight
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key) as Promise<T>;
    }

    // Create new request
    const promise = requestFn().finally(() => {
        pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
}

/**
 * TTL Cache for API responses
 */
export class TTLCache<T> {
    private cache = new Map<string, { data: T; expires: number }>();
    private defaultTTL: number;

    constructor(defaultTTLMs: number = 5 * 60 * 1000) {
        this.defaultTTL = defaultTTLMs;
    }

    get(key: string): T | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (cached.expires < Date.now()) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    set(key: string, data: T, ttlMs?: number): void {
        this.cache.set(key, {
            data,
            expires: Date.now() + (ttlMs || this.defaultTTL),
        });
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }
}

/**
 * Cleanup all caches - call on extension unload
 */
export function cleanupCaches(): void {
    selectorCache.clear();
    pendingRequests.clear();
}
