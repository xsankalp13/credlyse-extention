/**
 * VideoTracker - Core video tracking logic
 * Implements strict segment tracking with anti-skip protection
 */

import { saveProgress, getProgress } from './storageUtils';
import { showToast } from './Toast';

const MAX_PLAYBACK_RATE = 2.0;
const GAP_THRESHOLD = 1.0; // seconds - if gap > this, user skipped
const SAVE_DEBOUNCE_MS = 5000; // Save every 5 seconds
const COMPLETION_THRESHOLD = 0.98; // 98% watched = complete

export interface TrackerState {
    videoId: string;
    duration: number;
    watchedSegments: [number, number][];
    totalWatched: number;
    percentComplete: number;
    isComplete: boolean;
}

export class VideoTracker {
    private videoElement: HTMLVideoElement | null = null;
    private videoId: string;
    private duration: number = 0;
    private watchedSegments: [number, number][] = [];
    private lastRecordedTime: number = -1;
    private currentSegmentStart: number = -1;
    private isTracking: boolean = false;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private isComplete: boolean = false;
    private speedWarningShown: boolean = false;
    private isSpeedExceeded: boolean = false;

    // Bound event handlers for proper cleanup
    private boundHandleTimeUpdate: () => void;
    private boundHandleRateChange: () => void;
    private boundHandlePause: () => void;
    private boundHandleEnded: () => void;
    private boundHandleSeeked: () => void;
    private boundHandleLoadedMetadata: () => void;

    constructor(videoId: string) {
        this.videoId = videoId;

        // Bind handlers
        this.boundHandleTimeUpdate = this.handleTimeUpdate.bind(this);
        this.boundHandleRateChange = this.handleRateChange.bind(this);
        this.boundHandlePause = this.handlePause.bind(this);
        this.boundHandleEnded = this.handleEnded.bind(this);
        this.boundHandleSeeked = this.handleSeeked.bind(this);
        this.boundHandleLoadedMetadata = this.handleLoadedMetadata.bind(this);

        this.init();
    }

    /**
     * Initialize the tracker
     */
    private async init(): Promise<void> {
        // Find the video element
        this.videoElement = this.findVideoElement();
        if (!this.videoElement) {
            // Retry after a delay
            setTimeout(() => this.init(), 500);
            return;
        }

        // Load existing progress
        await this.loadProgress();

        // Get duration
        if (this.videoElement.readyState >= 1) {
            this.duration = this.videoElement.duration;
        }

        // Attach event listeners
        this.attachListeners();
        this.isTracking = true;

        console.log(`[VideoTracker] Initialized for video: ${this.videoId}`);
        this.emitProgressUpdate();
    }

    /**
     * Find the YouTube video element
     */
    private findVideoElement(): HTMLVideoElement | null {
        return document.querySelector('video.html5-main-video') ||
            document.querySelector('video');
    }

    /**
     * Load existing progress from storage
     */
    private async loadProgress(): Promise<void> {
        try {
            const progress = await getProgress(this.videoId);
            if (progress) {
                this.watchedSegments = progress.watchedSegments;
                this.isComplete = progress.isComplete;
                console.log(`[VideoTracker] Loaded progress: ${progress.totalWatched.toFixed(1)}s watched`);
            }
        } catch (e) {
            console.error('[VideoTracker] Failed to load progress:', e);
        }
    }

    /**
     * Attach event listeners to the video element
     */
    private attachListeners(): void {
        if (!this.videoElement) return;

        this.videoElement.addEventListener('timeupdate', this.boundHandleTimeUpdate);
        this.videoElement.addEventListener('ratechange', this.boundHandleRateChange);
        this.videoElement.addEventListener('pause', this.boundHandlePause);
        this.videoElement.addEventListener('ended', this.boundHandleEnded);
        this.videoElement.addEventListener('seeked', this.boundHandleSeeked);
        this.videoElement.addEventListener('loadedmetadata', this.boundHandleLoadedMetadata);
    }

    /**
     * Remove event listeners
     */
    private detachListeners(): void {
        if (!this.videoElement) return;

        this.videoElement.removeEventListener('timeupdate', this.boundHandleTimeUpdate);
        this.videoElement.removeEventListener('ratechange', this.boundHandleRateChange);
        this.videoElement.removeEventListener('pause', this.boundHandlePause);
        this.videoElement.removeEventListener('ended', this.boundHandleEnded);
        this.videoElement.removeEventListener('seeked', this.boundHandleSeeked);
        this.videoElement.removeEventListener('loadedmetadata', this.boundHandleLoadedMetadata);
    }

    /**
     * Handle metadata loaded - get duration
     */
    private handleLoadedMetadata(): void {
        if (this.videoElement) {
            this.duration = this.videoElement.duration;
            this.emitProgressUpdate();
        }
    }

    /**
     * Handle time update - core segment tracking logic
     */
    private handleTimeUpdate(): void {
        if (!this.videoElement || !this.isTracking || this.isComplete) return;

        // Don't track progress when speed exceeds limit
        if (this.isSpeedExceeded) return;

        const currentTime = this.videoElement.currentTime;

        // First recorded time
        if (this.lastRecordedTime < 0) {
            this.lastRecordedTime = currentTime;
            this.currentSegmentStart = currentTime;
            return;
        }

        const gap = currentTime - this.lastRecordedTime;

        // Check if this is a normal forward progression (no skip)
        if (gap > 0 && gap < GAP_THRESHOLD) {
            // Continue current segment
            this.lastRecordedTime = currentTime;
        } else if (gap >= GAP_THRESHOLD || gap < 0) {
            // User skipped forward or backward - close current segment
            if (this.currentSegmentStart >= 0 && this.lastRecordedTime > this.currentSegmentStart) {
                this.watchedSegments.push([this.currentSegmentStart, this.lastRecordedTime]);
                this.mergeSegments();
            }
            // Start new segment
            this.currentSegmentStart = currentTime;
            this.lastRecordedTime = currentTime;
        }

        // Schedule debounced save
        this.scheduleSave();
    }

    /**
     * Handle seek event - finalize current segment before seek
     */
    private handleSeeked(): void {
        if (!this.videoElement) return;

        // Close current segment before seek
        if (this.currentSegmentStart >= 0 && this.lastRecordedTime > this.currentSegmentStart) {
            this.watchedSegments.push([this.currentSegmentStart, this.lastRecordedTime]);
            this.mergeSegments();
        }

        // Reset for new segment
        const currentTime = this.videoElement.currentTime;
        this.currentSegmentStart = currentTime;
        this.lastRecordedTime = currentTime;

        this.emitProgressUpdate();
    }

    /**
     * Handle playback rate change - warn and pause tracking if speed exceeds limit
     */
    private handleRateChange(): void {
        if (!this.videoElement) return;

        if (this.videoElement.playbackRate > MAX_PLAYBACK_RATE) {
            // Finalize current segment before pausing tracking
            if (!this.isSpeedExceeded) {
                this.finalizeCurrentSegment();
                this.isSpeedExceeded = true;
            }

            // Show warning only once per speed change
            if (!this.speedWarningShown) {
                this.speedWarningShown = true;
                showToast({
                    message: `⚠️ Progress won't count above ${MAX_PLAYBACK_RATE}x speed`,
                    type: 'warning',
                    duration: 4000
                });
            }
        } else {
            // Speed is back to acceptable range, resume tracking
            if (this.isSpeedExceeded) {
                this.isSpeedExceeded = false;
                // Reset segment tracking for resumed playback
                if (this.videoElement) {
                    this.currentSegmentStart = this.videoElement.currentTime;
                    this.lastRecordedTime = this.videoElement.currentTime;
                }
                showToast({
                    message: `✓ Progress tracking resumed at ${this.videoElement.playbackRate}x`,
                    type: 'success',
                    duration: 2000
                });
            }
            this.speedWarningShown = false;
        }
    }

    /**
     * Handle pause - save progress immediately
     */
    private handlePause(): void {
        this.finalizeCurrentSegment();
        this.saveProgressNow();
    }

    /**
     * Handle video ended
     */
    private handleEnded(): void {
        this.finalizeCurrentSegment();
        this.saveProgressNow();
        this.checkCompletion();
    }

    /**
     * Finalize the current segment
     */
    private finalizeCurrentSegment(): void {
        if (this.currentSegmentStart >= 0 && this.lastRecordedTime > this.currentSegmentStart) {
            this.watchedSegments.push([this.currentSegmentStart, this.lastRecordedTime]);
            this.mergeSegments();
        }
        this.currentSegmentStart = -1;
    }

    /**
     * Merge overlapping segments using interval merging algorithm
     */
    private mergeSegments(): void {
        if (this.watchedSegments.length <= 1) return;

        // Sort by start time
        const sorted = [...this.watchedSegments].sort((a, b) => a[0] - b[0]);
        const merged: [number, number][] = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const last = merged[merged.length - 1];
            const current = sorted[i];

            // If overlapping or adjacent (within 0.5s tolerance), merge
            if (current[0] <= last[1] + 0.5) {
                last[1] = Math.max(last[1], current[1]);
            } else {
                merged.push([...current] as [number, number]);
            }
        }

        this.watchedSegments = merged;
    }

    /**
     * Calculate total watched time from segments
     */
    private calculateTotalWatched(): number {
        return this.watchedSegments.reduce((total, [start, end]) => {
            return total + (end - start);
        }, 0);
    }

    /**
     * Schedule a debounced save
     */
    private scheduleSave(): void {
        if (this.saveTimeout) return; // Already scheduled

        this.saveTimeout = setTimeout(() => {
            this.saveProgressNow();
            this.saveTimeout = null;
        }, SAVE_DEBOUNCE_MS);
    }

    /**
     * Save progress immediately
     */
    private async saveProgressNow(): Promise<void> {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        // Include current in-progress segment
        const segmentsToSave = [...this.watchedSegments];
        if (this.currentSegmentStart >= 0 && this.lastRecordedTime > this.currentSegmentStart) {
            segmentsToSave.push([this.currentSegmentStart, this.lastRecordedTime]);
        }

        // Merge for accurate count
        const tempSegments = this.mergeSegmentsArray(segmentsToSave);
        const totalWatched = tempSegments.reduce((t, [s, e]) => t + (e - s), 0);

        try {
            await saveProgress(
                this.videoId,
                tempSegments,
                this.isComplete,
                totalWatched,
                this.duration
            );
            this.emitProgressUpdate();
        } catch (e) {
            console.error('[VideoTracker] Failed to save progress:', e);
        }
    }

    /**
     * Merge segments array (pure function)
     */
    private mergeSegmentsArray(segments: [number, number][]): [number, number][] {
        if (segments.length <= 1) return segments;

        const sorted = [...segments].sort((a, b) => a[0] - b[0]);
        const merged: [number, number][] = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const last = merged[merged.length - 1];
            if (sorted[i][0] <= last[1] + 0.5) {
                last[1] = Math.max(last[1], sorted[i][1]);
            } else {
                merged.push([...sorted[i]] as [number, number]);
            }
        }

        return merged;
    }

    /**
     * Check if video is complete
     */
    private checkCompletion(): void {
        if (this.isComplete || this.duration <= 0) return;

        const totalWatched = this.calculateTotalWatched();
        const percentComplete = totalWatched / this.duration;

        if (percentComplete >= COMPLETION_THRESHOLD) {
            this.isComplete = true;
            this.saveProgressNow();
            showToast({
                message: '🎉 Video completed! Great job staying focused!',
                type: 'success',
                duration: 5000
            });
            this.emitProgressUpdate();
        }
    }

    /**
     * Emit progress update event
     */
    private emitProgressUpdate(): void {
        const totalWatched = this.calculateTotalWatched();
        const percentComplete = this.duration > 0 ? (totalWatched / this.duration) * 100 : 0;

        const state: TrackerState = {
            videoId: this.videoId,
            duration: this.duration,
            watchedSegments: this.watchedSegments,
            totalWatched,
            percentComplete: Math.min(percentComplete, 100),
            isComplete: this.isComplete
        };

        window.dispatchEvent(new CustomEvent('progress-updated', { detail: state }));
    }

    /**
     * Get current tracker state
     */
    public getState(): TrackerState {
        const totalWatched = this.calculateTotalWatched();
        const percentComplete = this.duration > 0 ? (totalWatched / this.duration) * 100 : 0;

        return {
            videoId: this.videoId,
            duration: this.duration,
            watchedSegments: this.watchedSegments,
            totalWatched,
            percentComplete: Math.min(percentComplete, 100),
            isComplete: this.isComplete
        };
    }

    /**
     * Destroy the tracker and cleanup
     */
    public destroy(): void {
        this.isTracking = false;
        this.finalizeCurrentSegment();
        this.saveProgressNow();
        this.detachListeners();

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        this.videoElement = null;
        console.log(`[VideoTracker] Destroyed tracker for video: ${this.videoId}`);
    }
}

/**
 * Extract video ID from YouTube URL
 */
export function getVideoIdFromUrl(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}
