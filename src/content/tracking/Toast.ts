/**
 * Toast Notification Utility
 * Shows temporary notifications for speed warnings and other messages
 */

const TOAST_CONTAINER_ID = 'youtube-study-toast-container';

interface ToastOptions {
    message: string;
    type?: 'warning' | 'info' | 'success' | 'error';
    duration?: number;
}

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void {
    const { message, type = 'warning', duration = 3000 } = options;

    // Get or create container
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = TOAST_CONTAINER_ID;
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `study-toast study-toast-${type}`;
    toast.style.cssText = `
        background: ${getBackgroundColor(type)};
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Roboto', 'Arial', sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        pointer-events: auto;
    `;

    toast.innerHTML = `
        <span class="study-toast-icon">${getIcon(type)}</span>
        <span class="study-toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Add animation styles if not already present
    addAnimationStyles();

    // Auto-remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            toast.remove();
            // Remove container if empty
            if (container && container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, duration);
}

function getBackgroundColor(type: string): string {
    switch (type) {
        case 'warning':
            return '#f59e0b';
        case 'error':
            return '#ef4444';
        case 'success':
            return '#22c55e';
        case 'info':
        default:
            return '#3b82f6';
    }
}

function getIcon(type: string): string {
    switch (type) {
        case 'warning':
            return '⚠️';
        case 'error':
            return '❌';
        case 'success':
            return '✅';
        case 'info':
        default:
            return 'ℹ️';
    }
}

function addAnimationStyles(): void {
    const styleId = 'study-toast-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(style);
}
