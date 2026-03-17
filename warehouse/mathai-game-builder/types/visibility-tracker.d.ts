/**
 * TypeScript type definitions for VisibilityTracker
 *
 * VisibilityTracker - Tracks tab visibility changes and manages pause/resume of activities
 *
 * @example Load from CDN (via Helpers package)
 * ```html
 * <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
 * ```
 *
 * @example Basic usage with timer
 * ```typescript
 * const timer = new TimerComponent('timer-container', {
 *   timerType: 'decrease',
 *   startTime: 60,
 *   autoStart: true
 * });
 *
 * const tracker = new VisibilityTracker({
 *   onInactive: () => {
 *     timer.pause();
 *     console.log('Timer paused - user inactive');
 *   },
 *   onResume: () => {
 *     timer.resume();
 *     console.log('Timer resumed - user active');
 *   }
 * });
 * ```
 *
 * @example Usage with FeedbackManager audio
 * ```typescript
 * const tracker = new VisibilityTracker({
 *   onInactive: () => {
 *     FeedbackManager.sound.pause();
 *     console.log('Audio paused - user inactive');
 *   },
 *   onResume: () => {
 *     FeedbackManager.sound.resume();
 *     console.log('Audio resumed - user active');
 *   }
 * });
 * ```
 */

declare namespace VisibilityTracker {
  /**
   * Configuration for the popup that appears when user becomes inactive
   */
  interface PopupConfig {
    /** URL to Lottie animation JSON for popup icon */
    icon?: string;

    /** Title text shown in popup */
    title?: string;

    /** Description/message text shown in popup */
    description?: string;

    /** Text for primary (resume) button */
    primaryText?: string;

    /** Whether to show secondary button */
    hasSecondary?: boolean;

    /** Text for secondary button (if hasSecondary is true) */
    secondaryText?: string;

    /** Z-index for popup positioning */
    zIndex?: number;

    /** Callback when primary button is clicked (called before onResume) */
    primaryClick?: (event: Event) => void;

    /** Callback when secondary button is clicked */
    secondaryClick?: (event: Event) => void;
  }

  /**
   * Configuration for VisibilityTracker instance
   */
  interface Config {
    /**
     * Callback executed when user goes inactive (switches tab/minimizes window)
     * Use this to pause timers, audio, animations, etc.
     *
     * @example
     * ```typescript
     * onInactive: () => {
     *   timer.pause();
     *   FeedbackManager.sound.pause();
     * }
     * ```
     */
    onInactive?: () => void;

    /**
     * Callback executed when user clicks resume in popup
     * Use this to resume timers, audio, animations, etc.
     *
     * @example
     * ```typescript
     * onResume: () => {
     *   timer.resume();
     *   FeedbackManager.sound.resume();
     * }
     * ```
     */
    onResume?: () => void;

    /** Configuration for the resume popup */
    popupProps?: PopupConfig;

    /** Whether to automatically show popup when inactive (default: true) */
    autoShowPopup?: boolean;

    /** Whether tracking is enabled on initialization (default: true) */
    enabled?: boolean;
  }
}

/**
 * VisibilityTracker class for monitoring tab visibility and managing activity state
 */
declare class VisibilityTracker {
  /**
   * Create a new VisibilityTracker instance
   *
   * @param config - Configuration object with callbacks and popup settings
   *
   * @example Basic timer pause/resume
   * ```typescript
   * const timer = new TimerComponent('timer', { startTime: 60 });
   *
   * const tracker = new VisibilityTracker({
   *   onInactive: () => timer.pause(),
   *   onResume: () => timer.resume()
   * });
   * ```
   *
   * @example With audio and custom popup
   * ```typescript
   * const tracker = new VisibilityTracker({
   *   onInactive: () => {
   *     FeedbackManager.sound.pause();
   *     timer.pause();
   *   },
   *   onResume: () => {
   *     FeedbackManager.sound.resume();
   *     timer.resume();
   *   },
   *   popupProps: {
   *     title: 'Game Paused',
   *     description: 'Your game is paused. Click Resume to continue playing.',
   *     primaryText: 'Resume Game'
   *   }
   * });
   * ```
   */
  constructor(config?: VisibilityTracker.Config);

  /**
   * Start tracking visibility changes
   * Automatically called if enabled: true in config
   */
  start(): void;

  /**
   * Stop tracking visibility changes and hide popup if visible
   */
  stop(): void;

  /**
   * Check if user is currently in inactive state
   *
   * @returns true if user is inactive (switched tab), false otherwise
   */
  isUserInactive(): boolean;

  /**
   * Check if tracking is currently enabled
   *
   * @returns true if tracking is active, false otherwise
   */
  isEnabled(): boolean;

  /**
   * Manually trigger inactive state (useful for testing)
   * Calls onInactive callback and shows popup
   *
   * @example Testing pause behavior
   * ```typescript
   * // Test what happens when user goes inactive
   * tracker.triggerInactive();
   * ```
   */
  triggerInactive(): void;

  /**
   * Manually trigger resume (useful for testing or custom resume buttons)
   * Calls onResume callback and hides popup
   *
   * @example Testing resume behavior
   * ```typescript
   * // Test what happens when user resumes
   * tracker.triggerResume();
   * ```
   */
  triggerResume(): void;

  /**
   * Update configuration after initialization
   *
   * @param newConfig - Partial configuration to update
   *
   * @example Update callbacks dynamically
   * ```typescript
   * tracker.updateConfig({
   *   onInactive: () => {
   *     console.log('New inactive handler');
   *     timer.pause();
   *   }
   * });
   * ```
   */
  updateConfig(newConfig: Partial<VisibilityTracker.Config>): void;

  /**
   * Destroy the tracker and clean up all event listeners
   * Should be called when game/activity ends
   */
  destroy(): void;
}

// Global type declarations
interface Window {
  /**
   * Global VisibilityTracker class
   * Available after loading from CDN
   */
  VisibilityTracker: typeof VisibilityTracker;
}

export = VisibilityTracker;
export as namespace VisibilityTracker;
