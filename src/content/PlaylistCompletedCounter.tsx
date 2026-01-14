import React, { useState, useEffect } from 'react';

export function PlaylistCompletedCounter(): React.ReactElement {
    const [completed, setCompleted] = useState(2);
    const [total, setTotal] = useState(5);

    // Get playlist info from YouTube's playlist panel
    useEffect(() => {
        const updatePlaylistInfo = () => {
            // Try to get the total videos from playlist
            const playlistItems = document.querySelectorAll('ytd-playlist-panel-video-renderer');
            if (playlistItems.length > 0) {
                setTotal(playlistItems.length);
            }

            // Get current video index
            const currentIndexEl = document.querySelector('ytd-playlist-panel-renderer #index');
            if (currentIndexEl) {
                const index = parseInt(currentIndexEl.textContent || '1', 10);
                // Set completed as current index (assuming previous videos are done)
                setCompleted(Math.max(0, index - 1));
            }
        };

        updatePlaylistInfo();

        // Update on navigation
        const observer = new MutationObserver(() => {
            updatePlaylistInfo();
        });

        const playlistPanel = document.querySelector('ytd-playlist-panel-renderer');
        if (playlistPanel) {
            observer.observe(playlistPanel, { childList: true, subtree: true });
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div className="study-playlist-counter">
            <span className="study-playlist-counter-label">Completed</span>
            <span className="study-playlist-counter-value">{completed}/{total}</span>
        </div>
    );
}
