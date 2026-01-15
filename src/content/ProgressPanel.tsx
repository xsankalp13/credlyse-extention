import React, { useState, useEffect } from 'react';
import type { TrackerState } from './tracking';
import { AuthStatus } from './auth/AuthStatus';
import {
    getAuthState,
    checkPlaylistStatus,
    enrollInPlaylist,
    getPlaylistIdFromUrl,
    type PlaylistStatus,
    type User
} from './auth/authService';

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

type PanelState = 'loading' | 'not_logged_in' | 'playlist_not_found' | 'not_enrolled' | 'enrolled';

export function ProgressPanel(): React.ReactElement {
    const [progress, setProgress] = useState(0);
    const [watched, setWatched] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isPlaylist, setIsPlaylist] = useState(false);

    // New state for conditional rendering
    const [panelState, setPanelState] = useState<PanelState>('loading');
    const [playlistStatus, setPlaylistStatus] = useState<PlaylistStatus | null>(null);
    const [isEnrolling, setIsEnrolling] = useState(false);
    // const [user, setUser] = useState<User | null>(null); // Unused


    // Check auth and playlist status
    useEffect(() => {
        async function checkStatus() {
            const playlistId = getPlaylistIdFromUrl();
            if (!playlistId) {
                setPanelState('loading');
                return;
            }

            // Check auth state
            const authState = await getAuthState();
            // setUser(authState.user);

            if (!authState.isAuthenticated) {
                setPanelState('not_logged_in');
                return;
            }

            // Check playlist status
            const status = await checkPlaylistStatus(playlistId);
            setPlaylistStatus(status);

            // Dispatch status update for index.tsx to handle button injection/hiding
            window.dispatchEvent(new CustomEvent('playlist-status-updated', {
                detail: status
            }));

            if (!status || !status.playlist_exists) {
                setPanelState('playlist_not_found');
                return;
            }

            if (!status.is_enrolled) {
                setPanelState('not_enrolled');
                return;
            }

            setPanelState('enrolled');

            // Cache videos in localStorage for quiz access
            if (status.videos && status.videos.length > 0) {
                localStorage.setItem(`credlyse_playlist_${playlistId}`, JSON.stringify(status));
            }
        }

        checkStatus();

        // Recheck on URL change
        const handleUrlChange = () => setTimeout(checkStatus, 500);
        window.addEventListener('popstate', handleUrlChange);

        return () => window.removeEventListener('popstate', handleUrlChange);
    }, []);

    // Handle enrollment
    const handleEnroll = async () => {
        if (!playlistStatus?.playlist_id) return;

        setIsEnrolling(true);
        const result = await enrollInPlaylist(playlistStatus.playlist_id);

        if (result.success) {
            setPanelState('enrolled');
            // Update cached status
            const newStatus = { ...playlistStatus, is_enrolled: true, enrollment_id: result.enrollment_id ?? null };
            setPlaylistStatus(newStatus);
            const playlistId = getPlaylistIdFromUrl();
            if (playlistId) {
                localStorage.setItem(`credlyse_playlist_${playlistId}`, JSON.stringify(newStatus));
            }
            // Dispatch event to enable quiz buttons
            window.dispatchEvent(new CustomEvent('playlist-enrolled'));
        } else {
            console.error('[Credlyse] Enrollment failed:', result.error);
        }

        setIsEnrolling(false);
    };

    // Handle auth state changes
    const handleAuthStateChange = (isAuthenticated: boolean, _newUser: User | null) => {
        // setUser(newUser);
        if (isAuthenticated) {
            // Recheck playlist status when user logs in
            const playlistId = getPlaylistIdFromUrl();
            if (playlistId) {
                checkPlaylistStatus(playlistId).then(status => {
                    setPlaylistStatus(status);
                    if (!status || !status.playlist_exists) {
                        setPanelState('playlist_not_found');
                    } else if (!status.is_enrolled) {
                        setPanelState('not_enrolled');
                    } else {
                        setPanelState('enrolled');
                    }
                });
            }
        } else {
            setPanelState('not_logged_in');
        }
    };

    // Listen for progress updates from VideoTracker
    useEffect(() => {
        const handleProgressUpdate = (e: CustomEvent<TrackerState>) => {
            const state = e.detail;
            setProgress(Math.round(state.percentComplete));
            setWatched(state.totalWatched);
            setRemaining(Math.max(0, state.duration - state.totalWatched));
            setIsComplete(state.isComplete);
        };

        window.addEventListener('progress-updated', handleProgressUpdate as EventListener);

        return () => {
            window.removeEventListener('progress-updated', handleProgressUpdate as EventListener);
        };
    }, []);

    // Detect if we're watching a playlist
    useEffect(() => {
        const checkPlaylist = () => {
            const urlParams = new URLSearchParams(window.location.search);
            setIsPlaylist(urlParams.has('list'));
        };

        checkPlaylist();

        const handleUrlChange = () => {
            setTimeout(checkPlaylist, 100);
        };

        window.addEventListener('popstate', handleUrlChange);

        return () => {
            window.removeEventListener('popstate', handleUrlChange);
        };
    }, []);

    const getMessage = () => {
        if (isComplete) {
            return '🎉 Completed! Great job staying focused!';
        } else if (progress >= 75) {
            return 'Almost there! Keep going! 💪';
        } else if (progress >= 50) {
            return 'Halfway done! You\'re doing great! 🚀';
        } else if (progress >= 25) {
            return 'Good progress! Stay focused! 📚';
        } else {
            return 'Stay focused! You\'re making great progress. 🎯';
        }
    };

    // Render loading state
    if (panelState === 'loading') {
        return (
            <div className={`study-progress-panel ${isPlaylist ? 'playlist-mode' : ''}`}>
                <div className="study-progress-header">
                    <span className="study-progress-icon">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
                        </svg>
                    </span>
                    <h3 className="study-progress-title">Study Progress</h3>
                </div>
                <div className="study-progress-content" style={{ textAlign: 'center', padding: '20px' }}>
                    <div className="study-auth-spinner"></div>
                    <p style={{ marginTop: '10px', color: '#aaa' }}>Loading...</p>
                </div>
            </div>
        );
    }

    // Render not logged in state
    if (panelState === 'not_logged_in') {
        return (
            <div className={`study-progress-panel ${isPlaylist ? 'playlist-mode' : ''}`}>
                <div className="study-progress-header">
                    <span className="study-progress-icon">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
                        </svg>
                    </span>
                    <h3 className="study-progress-title">Study Progress</h3>
                </div>
                <AuthStatus onAuthStateChange={handleAuthStateChange} />
            </div>
        );
    }

    // Render playlist not found state
    if (panelState === 'playlist_not_found') {
        return (
            <div className={`study-progress-panel ${isPlaylist ? 'playlist-mode' : ''}`}>
                <div className="study-progress-header">
                    <span className="study-progress-icon">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
                        </svg>
                    </span>
                    <h3 className="study-progress-title">Study Progress</h3>
                </div>
                <div className="study-progress-content" style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ color: '#aaa', marginBottom: '15px' }}>
                        This playlist is not yet available on Credlyse.
                    </p>
                    <button className="study-wishlist-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        Add to Wishlist
                    </button>
                </div>
                <AuthStatus onAuthStateChange={handleAuthStateChange} />
            </div>
        );
    }

    // Render not enrolled state
    if (panelState === 'not_enrolled') {
        return (
            <div className={`study-progress-panel ${isPlaylist ? 'playlist-mode' : ''}`}>
                <div className="study-progress-header">
                    <span className="study-progress-icon">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
                        </svg>
                    </span>
                    <h3 className="study-progress-title">{playlistStatus?.playlist_title || 'Course'}</h3>
                </div>
                <div className="study-progress-content" style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ color: '#aaa', marginBottom: '15px' }}>
                        Enroll to track your progress and access quizzes!
                    </p>
                    <button
                        className="study-enroll-btn"
                        onClick={handleEnroll}
                        disabled={isEnrolling}
                    >
                        {isEnrolling ? (
                            <>
                                <div className="study-auth-spinner" style={{ width: '16px', height: '16px' }}></div>
                                Enrolling...
                            </>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                Enroll in Course
                            </>
                        )}
                    </button>
                </div>
                <AuthStatus onAuthStateChange={handleAuthStateChange} />
            </div>
        );
    }

    // Render enrolled state (full progress panel)
    return (
        <div className={`study-progress-panel ${isPlaylist ? 'playlist-mode' : ''} ${isComplete ? 'completed' : ''}`}>
            <div className="study-progress-header">
                <span className="study-progress-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
                    </svg>
                </span>
                <h3 className="study-progress-title">Study Progress</h3>
                {/* Completion tick indicator */}
                <span className={`study-completion-tick ${isComplete ? 'completed' : ''}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                </span>
            </div>

            <div className="study-progress-content">
                <div className="study-progress-stats">
                    <span className="study-progress-percentage">{progress}%</span>
                    <span className="study-progress-label">Complete</span>
                </div>

                <div className="study-progress-bar-container">
                    <div
                        className="study-progress-bar-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="study-progress-time">
                    <div className="study-progress-time-item">
                        <span className="study-progress-time-value">{formatTime(watched)}</span>
                        <span className="study-progress-time-label">Watched</span>
                    </div>
                    <div className="study-progress-time-item">
                        <span className="study-progress-time-value">{formatTime(remaining)}</span>
                        <span className="study-progress-time-label">Remaining</span>
                    </div>
                </div>
            </div>

            <div className="study-progress-message">
                <p>{getMessage()}</p>
            </div>

            {/* Auth Status - Shows login state */}
            <AuthStatus onAuthStateChange={handleAuthStateChange} />
        </div>
    );
}

