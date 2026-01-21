import React, { useState, useEffect } from 'react';
import { type PlaylistStatus, getPlaylistIdFromUrl } from './auth/authService';

export function ProgressWheel(): React.ReactElement {
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const calculateProgress = (status: PlaylistStatus) => {
        if (!status || !status.videos || status.videos.length === 0) {
            setIsVisible(false);
            return;
        }

        let totalQuizzes = 0;
        let completedQuizzes = 0;

        status.videos.forEach(video => {
            // Only count quizzes for progress
            if (video.has_quiz) {
                totalQuizzes++;
                if (video.is_quiz_passed) completedQuizzes++;
            }
        });

        if (totalQuizzes > 0) {
            setProgress(Math.round((completedQuizzes / totalQuizzes) * 100));
            setIsVisible(true);
        } else {
            // No quizzes in this playlist, hide the wheel
            setIsVisible(false);
        }
    };

    useEffect(() => {
        // 1. Try to load from localStorage first (immediate render)
        const playlistId = getPlaylistIdFromUrl();
        if (playlistId) {
            try {
                const cached = localStorage.getItem(`credlyse_playlist_${playlistId}`);
                if (cached) {
                    const status = JSON.parse(cached);
                    calculateProgress(status);
                }
            } catch (e) {
                console.warn('[ProgressWheel] Failed to load cached status', e);
            }
        }

        // 2. Listen for updates
        const handleStatusUpdate = (e: CustomEvent<PlaylistStatus>) => {
            calculateProgress(e.detail);
        };

        window.addEventListener('playlist-status-updated', handleStatusUpdate as EventListener);

        return () => {
            window.removeEventListener('playlist-status-updated', handleStatusUpdate as EventListener);
        };
    }, []);

    if (!isVisible) return <></>;

    // SVG circle properties
    const size = 40;
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="progress-wheel-container" title={`${progress}% Complete`}>
            <svg
                className="progress-wheel-svg"
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
            >
                {/* Background circle */}
                <circle
                    className="progress-wheel-bg"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    className="progress-wheel-progress"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </svg>
            <span className="progress-wheel-text">{progress}%</span>
        </div>
    );
}
