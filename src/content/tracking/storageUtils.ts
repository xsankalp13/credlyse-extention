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

    return new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [key]: data }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        } else {
            // Fallback to localStorage for development
            try {
                localStorage.setItem(key, JSON.stringify(data));
                resolve();
            } catch (e) {
                reject(e);
            }
        }
    });
}

/**
 * Get video progress from chrome.storage.local
 */
export async function getProgress(videoId: string): Promise<VideoProgress | null> {
    const key = getStorageKey(videoId);

    return new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result[key] || null);
                }
            });
        } else {
            // Fallback to localStorage for development
            try {
                const data = localStorage.getItem(key);
                resolve(data ? JSON.parse(data) : null);
            } catch (e) {
                reject(e);
            }
        }
    });
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
