/**
 * Storage Utilities for Video Progress Tracking
 * Uses chrome.storage.local for persistent storage
 */

export interface VideoProgress {
    videoId: string;
    watchedSegments: [number, number][];
    isComplete: boolean;
    totalWatched: number;
    duration: number;
    lastUpdated: number;
}

const STORAGE_KEY_PREFIX = 'video_progress_';

/**
 * Get the storage key for a video
 */
function getStorageKey(videoId: string): string {
    return `${STORAGE_KEY_PREFIX}${videoId}`;
}

/**
 * Check if extension context is still valid
 */
function isExtensionContextValid(): boolean {
    try {
        // If we can access chrome.runtime.id, the context is valid
        return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch {
        return false;
    }
}

/**
 * Save video progress to chrome.storage.local
 */
export async function saveProgress(
    videoId: string,
    segments: [number, number][],
    isComplete: boolean,
    totalWatched: number,
    duration: number
): Promise<void> {
    const key = getStorageKey(videoId);
    const data: VideoProgress = {
        videoId,
        watchedSegments: segments,
        isComplete,
        totalWatched,
        duration,
        lastUpdated: Date.now()
    };

    // Always save to localStorage as backup
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('[VideoTracker] Failed to save to localStorage:', e);
    }

    // Try chrome.storage if context is valid
    if (isExtensionContextValid() && chrome.storage?.local) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: data }, () => {
                if (chrome.runtime.lastError) {
                    // Context may have been invalidated during the call
                    console.warn('[VideoTracker] Chrome storage save failed:', chrome.runtime.lastError.message);
                    resolve(); // Don't reject, we have localStorage backup
                } else {
                    resolve();
                }
            });
        });
    }

    // If chrome.storage not available, we already saved to localStorage
    return Promise.resolve();
}

/**
 * Get video progress from chrome.storage.local
 */
export async function getProgress(videoId: string): Promise<VideoProgress | null> {
    const key = getStorageKey(videoId);

    // Try chrome.storage first if context is valid
    if (isExtensionContextValid() && chrome.storage?.local) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    console.warn('[VideoTracker] Chrome storage get failed:', chrome.runtime.lastError.message);
                    // Fallback to localStorage
                    const data = localStorage.getItem(key);
                    resolve(data ? JSON.parse(data) : null);
                } else {
                    resolve(result[key] || null);
                }
            });
        });
    }

    // Fallback to localStorage
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn('[VideoTracker] Failed to get from localStorage:', e);
        return null;
    }
}

/**
 * Clear video progress from storage
 */
export async function clearProgress(videoId: string): Promise<void> {
    const key = getStorageKey(videoId);

    return new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove([key], () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        } else {
            // Fallback to localStorage for development
            try {
                localStorage.removeItem(key);
                resolve();
            } catch (e) {
                reject(e);
            }
        }
    });
}

/**
 * Get all video progress entries
 */
export async function getAllProgress(): Promise<VideoProgress[]> {
    return new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(null, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    const entries: VideoProgress[] = [];
                    for (const key in result) {
                        if (key.startsWith(STORAGE_KEY_PREFIX)) {
                            entries.push(result[key]);
                        }
                    }
                    resolve(entries);
                }
            });
        } else {
            // Fallback to localStorage for development
            try {
                const entries: VideoProgress[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
                        const data = localStorage.getItem(key);
                        if (data) {
                            entries.push(JSON.parse(data));
                        }
                    }
                }
                resolve(entries);
            } catch (e) {
                reject(e);
            }
        }
    });
}
