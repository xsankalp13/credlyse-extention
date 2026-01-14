import React from 'react';

export function ProgressWheel(): React.ReactElement {
    // Static progress value for UI - logic will be added later
    const progress = 35;

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
