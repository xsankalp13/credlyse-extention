/**
 * Auth Service for YouTube Study Mode Extension
 * 
 * Handles authentication with the Credlyse backend and token management.
 * Uses chrome.storage for secure token storage.
 */

const API_BASE_URL = 'http://127.0.0.1:8000';


// Helper to proxy requests through background script (bypassing CORS/Mixed Content)
async function proxyFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
        // partial serialization of headers
        const headers: Record<string, string> = {};
        if (options.headers) {
            if (options.headers instanceof Headers) {
                options.headers.forEach((v, k) => headers[k] = v);
            } else if (Array.isArray(options.headers)) {
                options.headers.forEach(([k, v]) => headers[k] = v);
            } else {
                Object.assign(headers, options.headers);
            }
        }

        chrome.runtime.sendMessage({
            type: 'PROXY_API_REQUEST',
            endpoint,
            options: {
                ...options,
                headers
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Credlyse] Proxy message failed:', chrome.runtime.lastError);
                return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!response) {
                return reject(new Error('No response from background script'));
            }

            // Construct a fake Response object compatible with our usage
            const mockResponse = {
                ok: response.success,
                status: response.status,
                statusText: response.statusText,
                json: async () => response.data,
                text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                headers: new Headers(),
                clone: () => mockResponse, // simplistic clone
            } as unknown as Response;

            resolve(mockResponse);
        });
    });
}

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: 'STUDENT' | 'CREATOR' | 'ADMIN';
}

export interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    token: string | null;
}

// Check if extension context is still valid
function isExtensionContextValid(): boolean {
    try {
        return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch {
        return false;
    }
}

// Get stored auth state from chrome storage
export async function getAuthState(): Promise<AuthState> {
    // If extension context is invalid, return unauthenticated
    if (!isExtensionContextValid()) {
        console.warn('[Credlyse] Extension context invalid, returning unauthenticated');
        return { isAuthenticated: false, user: null, token: null };
    }

    return new Promise((resolve) => {
        try {
            chrome.storage.local.get(['access_token', 'user'], (result) => {
                if (chrome.runtime.lastError) {
                    console.warn('[Credlyse] Failed to get auth state:', chrome.runtime.lastError.message);
                    resolve({ isAuthenticated: false, user: null, token: null });
                } else {
                    resolve({
                        isAuthenticated: !!result.access_token,
                        user: result.user || null,
                        token: result.access_token || null,
                    });
                }
            });
        } catch (e) {
            console.warn('[Credlyse] Exception getting auth state:', e);
            resolve({ isAuthenticated: false, user: null, token: null });
        }
    });
}

// Store auth token and user data
export async function setAuthState(token: string, user: User): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set({
            access_token: token,
            user: user,
        }, resolve);
    });
}

// Clear auth state (logout)
export async function clearAuthState(): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.remove(['access_token', 'user'], resolve);
    });
}

// Login with email and password
export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await proxyFetch(`/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            const error = await response.json();
            return { success: false, error: error.detail || 'Login failed' };
        }

        const tokenData = await response.json();
        const token = tokenData.access_token;

        // Fetch user details
        const userResponse = await proxyFetch(`/api/v1/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!userResponse.ok) {
            return { success: false, error: 'Failed to get user info' };
        }

        const user = await userResponse.json();
        await setAuthState(token, user);

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Network error. Is the backend running?' };
    }
}

// Logout
export async function logout(): Promise<void> {
    await clearAuthState();
}

// Make authenticated API request
export async function authenticatedFetch(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const { token } = await getAuthState();

    if (!token) {
        throw new Error('Not authenticated');
    }

    const headers: Record<string, string> = {};
    if (options.headers) {
        if (options.headers instanceof Headers) {
            options.headers.forEach((v, k) => headers[k] = v);
        } else if (!Array.isArray(options.headers)) {
            Object.assign(headers, options.headers);
        }
    }
    headers['Authorization'] = `Bearer ${token}`;

    return proxyFetch(endpoint, {
        ...options,
        headers,
    });
}

// Check if token is still valid
export async function validateToken(): Promise<boolean> {
    try {
        const { token } = await getAuthState();
        if (!token) return false;

        const response = await proxyFetch(`/api/v1/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        return response.ok;
    } catch {
        return false;
    }
}

// Open dashboard app for login (external redirect)
export function openDashboardLogin(): void {
    chrome.tabs.create({ url: 'http://localhost:3001/login' });
}

// Listen for auth state changes (for UI updates)
export function onAuthStateChange(callback: (state: AuthState) => void): () => void {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes.access_token || changes.user) {
            getAuthState().then(callback);
        }
    };

    chrome.storage.onChanged.addListener(listener);

    // Return cleanup function
    return () => chrome.storage.onChanged.removeListener(listener);
}


// ============================================
// Extension-specific API functions
// ============================================

export interface VideoInfo {
    id: number;
    youtube_video_id: string;
    title: string;
    has_quiz: boolean;
    order: number;
    is_watched?: boolean;
    is_quiz_passed?: boolean;
}

export interface PlaylistStatus {
    playlist_exists: boolean;
    playlist_id: number | null;
    playlist_title: string | null;
    is_enrolled: boolean;
    enrollment_id: number | null;
    videos: VideoInfo[];
}

export interface QuizQuestion {
    q: string;
    options: string[];
    answer: string;
}

export interface VideoQuiz {
    has_quiz: boolean;
    video_id?: number;
    video_title?: string;
    questions: QuizQuestion[];
}

/**
 * Check if a YouTube playlist exists in our database and user's enrollment status
 */
export async function checkPlaylistStatus(youtubePlaylistId: string): Promise<PlaylistStatus | null> {
    try {
        // Check if we have auth first
        const { isAuthenticated } = await getAuthState();

        if (isAuthenticated) {
            try {
                const response = await authenticatedFetch(
                    `/api/v1/extension/playlist-status?youtube_playlist_id=${encodeURIComponent(youtubePlaylistId)}`
                );

                if (response.ok) {
                    return await response.json();
                }
            } catch (e) {
                // If auth fetch fails (e.g. token expired), fall back to public
                // Don't log as error, just warn
                // console.warn('[Credlyse] Auth fetch failed, trying public:', e);
            }
        }

        // Public fetch (fallback or if not authenticated)
        // This allows checking if the playlist exists even if logged out
        const publicResponse = await proxyFetch(
            `/api/v1/extension/playlist-status?youtube_playlist_id=${encodeURIComponent(youtubePlaylistId)}`
        );

        if (publicResponse.ok) {
            return await publicResponse.json();
        }

        return null;
    } catch (error) {
        // Only log real network errors
        console.warn('[Credlyse] Failed to check playlist status:', error);
        return null;
    }
}

/**
 * Get quiz data for a specific video
 */
export async function getVideoQuiz(videoId: number): Promise<VideoQuiz | null> {
    try {
        const response = await proxyFetch(`/api/v1/extension/video-quiz/${videoId}`);

        if (!response.ok) {
            console.error('[Credlyse] Failed to fetch quiz:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[Credlyse] Failed to get video quiz:', error);
        return null;
    }
}

/**
 * Enroll the current user in a playlist/course
 */
export async function enrollInPlaylist(playlistId: number): Promise<{ success: boolean; enrollment_id?: number; error?: string }> {
    try {
        const response = await authenticatedFetch(`/api/v1/extension/enroll/${playlistId}`, {
            method: 'POST',
        });

        if (!response.ok) {
            const error = await response.json();
            return { success: false, error: error.detail || 'Enrollment failed' };
        }

        const data = await response.json();
        return { success: true, enrollment_id: data.enrollment_id };
    } catch (error) {
        return { success: false, error: 'Not authenticated. Please login first.' };
    }
}

/**
 * Get YouTube playlist ID from current URL
 */
export function getPlaylistIdFromUrl(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('list');
}
