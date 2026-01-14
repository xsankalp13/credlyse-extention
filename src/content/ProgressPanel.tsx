import React, { useState, useEffect } from 'react';

export function ProgressPanel(): React.ReactElement {
    // Static progress value for UI - logic will be added later
    const progress = 35;
    const [isPlaylist, setIsPlaylist] = useState(false);

    // Detect if we're watching a playlist
    useEffect(() => {
        const checkPlaylist = () => {
            const urlParams = new URLSearchParams(window.location.search);
            setIsPlaylist(urlParams.has('list'));
        };

        checkPlaylist();

        // Listen for URL changes
        const handleUrlChange = () => {
            setTimeout(checkPlaylist, 100);
        };

        window.addEventListener('popstate', handleUrlChange);

        return () => {
            window.removeEventListener('popstate', handleUrlChange);
        };
    }, []);

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
                        <span className="study-progress-time-value">22:15</span>
                        <span className="study-progress-time-label">Watched</span>
                    </div>
                    <div className="study-progress-time-item">
                        <span className="study-progress-time-value">41:05</span>
                        <span className="study-progress-time-label">Remaining</span>
                    </div>
                </div>
            </div>

            <div className="study-progress-message">
                <p>Stay focused! You're making great progress. 🎯</p>
            </div>
        </div>
    );
}
