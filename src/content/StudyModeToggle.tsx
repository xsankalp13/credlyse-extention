import React, { useState, useEffect } from 'react';

export function StudyModeToggle(): React.ReactElement {
    const [isEnabled, setIsEnabled] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Load saved state from Chrome storage
    useEffect(() => {
        // Safety check for chrome.storage
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['studyModeEnabled'], (result) => {
                setIsEnabled(result.studyModeEnabled ?? false);
                setIsLoading(false);
            });
        } else {
            // Fallback to localStorage if chrome.storage is not available
            try {
                const saved = localStorage.getItem('studyModeEnabled');
                setIsEnabled(saved === 'true');
            } catch {
                // Ignore localStorage errors
            }
            setIsLoading(false);
        }
    }, []);

    // Apply study mode styles when state changes
    useEffect(() => {
        if (isLoading) return;

        const body = document.body;

        if (isEnabled) {
            body.classList.add('youtube-study-mode-active');
        } else {
            body.classList.remove('youtube-study-mode-active');
        }

        // Save state to Chrome storage (with safety check)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ studyModeEnabled: isEnabled });
        } else {
            // Fallback to localStorage
            try {
                localStorage.setItem('studyModeEnabled', String(isEnabled));
            } catch {
                // Ignore localStorage errors
            }
        }
    }, [isEnabled, isLoading]);

    const handleToggle = () => {
        setIsEnabled((prev) => !prev);
    };

    if (isLoading) {
        return <></>;
    }

    return (
        <div className="study-mode-wrapper">
            <button
                className={`study-mode-toggle ${isEnabled ? 'active' : ''}`}
                onClick={handleToggle}
                title={isEnabled ? 'Disable Study Mode' : 'Enable Study Mode'}
                aria-label={isEnabled ? 'Disable Study Mode' : 'Enable Study Mode'}
                aria-pressed={isEnabled}
            >
                <span className="study-mode-label">Study Mode</span>
                <span className="study-mode-switch">
                    <span className="study-mode-switch-thumb"></span>
                </span>
            </button>
        </div>
    );
}
