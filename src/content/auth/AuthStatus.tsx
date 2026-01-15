import React, { useState, useEffect } from 'react';
import { getAuthState, type User, openDashboardLogin } from '../auth/authService';

interface AuthStatusProps {
    onAuthStateChange?: (isAuthenticated: boolean, user: User | null) => void;
}

/**
 * Auth Status Component
 * Shows the current authentication status and allows users to login/logout
 */
export const AuthStatus: React.FC<AuthStatusProps> = ({ onAuthStateChange }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load initial auth state
        loadAuthState();

        // Listen for storage changes (when token is set from dashboard)
        const handleStorageChange = () => {
            loadAuthState();
        };

        // Check for localStorage updates from dashboard (development mode)
        const checkLocalStorage = () => {
            const tokenData = localStorage.getItem('credlyse_token_for_extension');
            if (tokenData) {
                try {
                    const { token, user: userData } = JSON.parse(tokenData);
                    if (token && userData) {
                        // Store in chrome.storage for extension use
                        chrome.storage.local.set({ access_token: token, user: userData }, () => {
                            loadAuthState();
                            localStorage.removeItem('credlyse_token_for_extension');
                        });
                    }
                } catch (e) {
                    console.error('[Credlyse] Failed to parse token data from localStorage');
                }
            }
        };

        // Poll localStorage for development mode sync
        const interval = setInterval(checkLocalStorage, 2000);

        chrome.storage.onChanged.addListener(handleStorageChange);

        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    async function loadAuthState() {
        try {
            const state = await getAuthState();
            setIsAuthenticated(state.isAuthenticated);
            setUser(state.user);
            onAuthStateChange?.(state.isAuthenticated, state.user);
        } catch (error) {
            console.error('[Credlyse] Failed to load auth state:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const handleLogin = () => {
        openDashboardLogin();
    };

    const handleLogout = async () => {
        await chrome.storage.local.remove(['access_token', 'user']);
        setIsAuthenticated(false);
        setUser(null);
        onAuthStateChange?.(false, null);
    };

    if (isLoading) {
        return (
            <div className="study-auth-status study-auth-loading">
                <div className="study-auth-spinner"></div>
            </div>
        );
    }

    return (
        <div className="study-auth-status">
            {isAuthenticated && user ? (
                <div className="study-auth-user">
                    <div className="study-auth-avatar">
                        {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="study-auth-info">
                        <span className="study-auth-name">{user.full_name}</span>
                        <span className="study-auth-role">{user.role.toLowerCase()}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="study-auth-logout"
                        title="Logout"
                    >
                        ×
                    </button>
                </div>
            ) : (
                <button onClick={handleLogin} className="study-auth-login">
                    <svg className="study-auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Login to Credlyse
                </button>
            )}
        </div>
    );
};
