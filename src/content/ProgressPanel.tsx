import React, { useState, useEffect } from 'react';
import type { TrackerState } from './tracking';

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ProgressPanel(): React.ReactElement {
    const [progress, setProgress] = useState(0);
    const [watched, setWatched] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isPlaylist, setIsPlaylist] = useState(false);

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
        </div>
    );
}
