/**
 * TimerComponent Type Definitions
 *
 * A vanilla JavaScript timer component with countdown/countup functionality.
 * Displays time in MM:SS or SS format with customizable positioning and auto-start capability.
 *
 * Load via CDN (via Components package):
 * <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
 *
 * @version 1.0.0
 */

declare class TimerComponent {
  // ==================== Configuration Types ====================

  /**
   * Configuration object for TimerComponent
   */
  interface TimerConfig {
    /** Timer direction: 'increase' (count up) or 'decrease' (count down). Default: 'decrease' */
    timerType?: 'increase' | 'decrease';

    /** Display format: 'min' (MM:SS) or 'sec' (SS only). Default: 'min' */
    format?: 'min' | 'sec';

    /** Starting time in seconds. Default: 0 */
    startTime?: number;

    /** Ending time in seconds (timer stops when reached). Default: 0 */
    endTime?: number;

    /** Position timer in action bar style (top center of container). Default: false */
    showInActionBar?: boolean;

    /** Automatically start timer on creation. Default: true */
    autoStart?: boolean;

    /** Callback function when timer reaches endTime */
    onEnd?: ((timeTaken: number) => void) | null;
  }

  // ==================== Constructor ====================

  /**
   * Create a new TimerComponent instance
   *
   * @param containerId ID of the HTML element to render the timer in
   * @param config Configuration options
   * @throws Error if container element is not found
   *
   * @example
   * const timer = new TimerComponent('timer-container', {
   *   timerType: 'decrease',
   *   format: 'min',
   *   startTime: 60,
   *   endTime: 0,
   *   autoStart: true,
   *   onEnd: (timeTaken) => console.log('Done in', timeTaken, 'seconds')
   * });
   */
  constructor(containerId: string, config?: TimerComponent.TimerConfig);

  // ==================== Instance Properties ====================

  /** HTML container element */
  container: HTMLElement;

  /** Current configuration */
  config: Required<TimerComponent.TimerConfig>;

  /** Current time value in seconds */
  currentSeconds: number;

  /** Whether timer is currently running */
  isRunning: boolean;

  /** Whether timer is paused */
  isPaused: boolean;

  /** Internal interval ID */
  intervalId: number | null;

  // ==================== Core Methods ====================

  /**
   * Start the timer
   * Does nothing if timer is already running and not paused
   *
   * @example
   * timer.start();
   */
  start(): void;

  /**
   * Pause the timer
   * Timer continues running but time stops updating
   *
   * @param options - Additional options
   * @param options.fromAudio - Whether this call is from audio feedback system
   * @param options.fromVisibilityTracker - Whether this call is from visibility tracker
   *
   * @example
   * timer.pause();
   * timer.pause({ fromVisibilityTracker: true });
   */
  pause(options?: { fromAudio?: boolean; fromVisibilityTracker?: boolean }): void;

  /**
   * Resume a paused timer
   * Continues time progression
   *
   * @param options - Additional options
   * @param options.fromAudio - Whether this call is from audio feedback system
   * @param options.fromVisibilityTracker - Whether this call is from visibility tracker
   *
   * @example
   * timer.resume();
   * timer.resume({ fromVisibilityTracker: true });
   */
  resume(options?: { fromAudio?: boolean; fromVisibilityTracker?: boolean }): void;

  /**
   * Stop the timer completely
   * Clears the interval and resets state
   *
   * @example
   * timer.stop();
   */
  stop(): void;

  /**
   * Reset timer to start time
   * Stops timer and returns to initial value
   *
   * @example
   * timer.reset();
   */
  reset(): void;

  // ==================== State Methods ====================

  /**
   * Get current time value in seconds
   *
   * @returns Current seconds
   *
   * @example
   * const current = timer.getCurrentTime();
   * console.log('Current time:', current, 'seconds');
   */
  getCurrentTime(): number;

  /**
   * Get time elapsed since start
   * Returns absolute difference between start time and current time
   *
   * @returns Time taken in seconds
   *
   * @example
   * const elapsed = timer.getTimeTaken();
   * console.log('Time elapsed:', elapsed, 'seconds');
   */
  getTimeTaken(): number;

  // ==================== Configuration Methods ====================

  /**
   * Update timer configuration dynamically
   * Re-renders if showInActionBar changes
   *
   * @param newConfig Partial configuration to update
   *
   * @example
   * // Change timer direction
   * timer.updateConfig({
   *   timerType: 'increase',
   *   endTime: 120
   * });
   *
   * @example
   * // Change display format
   * timer.updateConfig({ format: 'sec' });
   */
  updateConfig(newConfig: Partial<TimerComponent.TimerConfig> & { seconds?: number }): void;

  /**
   * Set current time directly
   * Updates display immediately
   *
   * @param seconds New time value in seconds
   *
   * @example
   * timer.setTime(30); // Jump to 30 seconds
   */
  setTime(seconds: number): void;

  // ==================== Display Methods ====================

  /**
   * Get formatted time string based on current format setting
   *
   * @returns Formatted time string (MM:SS or SS)
   *
   * @example
   * const formatted = timer.getFormattedTime();
   * console.log(formatted); // "01:30" or "90"
   */
  getFormattedTime(): string;

  /**
   * Format seconds to MM:SS
   *
   * @param totalSeconds Seconds to format
   * @returns Formatted string MM:SS
   *
   * @example
   * const formatted = timer.toMinutesAndSeconds(90);
   * console.log(formatted); // "01:30"
   */
  toMinutesAndSeconds(totalSeconds: number): string;

  /**
   * Format seconds to SS
   *
   * @param totalSeconds Seconds to format
   * @returns Formatted string SS
   *
   * @example
   * const formatted = timer.toSeconds(5);
   * console.log(formatted); // "05"
   */
  toSeconds(totalSeconds: number): string;

  // ==================== Internal Methods ====================

  /**
   * Render the timer UI
   * Called internally on creation and configuration changes
   */
  render(): void;

  /**
   * Update the timer display
   * Called internally on each tick
   */
  updateDisplay(): void;

  /**
   * Timer tick logic
   * Called internally every second
   */
  tick(): void;

  /**
   * Destroy the timer and clean up resources
   * Removes all DOM elements and clears intervals
   *
   * @example
   * timer.destroy();
   */
  destroy(): void;
}

// ==================== Global Declaration ====================

/**
 * Global TimerComponent class
 * Available after loading the TimerComponent script
 */
declare const TimerComponent: typeof TimerComponent;

// ==================== Window Interface Extension ====================

interface Window {
  TimerComponent: typeof TimerComponent;
}

// ==================== Module Export ====================

declare module 'timer-component' {
  export = TimerComponent;
}
