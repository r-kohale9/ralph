/**
 * Standalone Timer Component
 * A vanilla JavaScript timer component with the same UI as the React version
 */

// Skip if already loaded
if (typeof window.TimerComponent !== "undefined") {
  console.log("[TimerComponent] Already loaded, skipping duplicate execution");
} else {

class TimerComponent {
  constructor(containerId, config = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Default configuration
    this.config = {
      timerType: "decrease", // 'increase' or 'decrease'
      format: "min", // 'sec' or 'min'
      startTime: 0,
      endTime: 0,
      showInActionBar: false,
      autoStart: true,
      onEnd: null, // Callback when timer reaches end
      ...config,
    };

    // State
    this.currentSeconds = this.config.startTime;
    this.isRunning = false;
    this.isPaused = false;
    this.intervalId = null;
    this.elapsedTimes = []; // Store elapsed times from previous sessions
    this.isExternallyControlled = false; // Start not externally controlled
    this.isPausedByAudio = false; // Track if currently paused by audio system
    this.isPausedByVisibilityTracker = false; // Track if currently paused by visibility tracker

    // Initialize
    this.render();
    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Formats seconds to MM:SS
   */
  toMinutesAndSeconds(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formattedMinutes = String(minutes).padStart(2, "0");
    const formattedSeconds = String(seconds).padStart(2, "0");
    return `${formattedMinutes}:${formattedSeconds}`;
  }

  /**
   * Formats seconds to SS
   */
  toSeconds(totalSeconds) {
    const formattedSeconds = String(totalSeconds).padStart(2, "0");
    return `${formattedSeconds}`;
  }

  /**
   * Gets the formatted time string
   */
  getFormattedTime() {
    if (this.config.format === "sec") {
      return this.toSeconds(this.currentSeconds);
    }
    return this.toMinutesAndSeconds(this.currentSeconds);
  }

  /**
   * Renders the timer UI
   */
  render() {
    const styles = this.config.showInActionBar
      ? "position: absolute; top: 0.5rem; left: 50%; transform: translateX(-50%); z-index: 50;"
      : "position: inherit; z-index: 1;";

    this.container.innerHTML = `
            <div class="timer-wrapper" style="${styles} pointer-events: auto; opacity: 1;">
                <div class="timer-display" style="
                    display: flex;
                    height: 41px;
                    width: 320px;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    font-weight: 500;
                    color: #000FFF;
                ">
                    ${this.getFormattedTime()}
                </div>
            </div>
        `;
  }

  /**
   * Updates the timer display
   */
  updateDisplay() {
    const displayElement = this.container.querySelector(".timer-display");
    if (displayElement) {
      displayElement.textContent = this.getFormattedTime();
    }
  }

  /**
   * Timer tick logic
   */
  tick() {
    const { timerType, endTime, onEnd } = this.config;

    // Check if we've reached the end
    if (this.currentSeconds === endTime) {
      this.stop();
      if (typeof onEnd === "function") {
        onEnd(this.getTimeTaken());
      }
      return;
    }

    // Update based on timer type
    if (timerType === "increase" && this.currentSeconds < endTime) {
      this.currentSeconds++;
    } else if (timerType === "decrease" && this.currentSeconds > endTime) {
      this.currentSeconds--;
    }

    this.updateDisplay();
  }

  /**
   * Starts the timer
   */
  start() {
    if (this.isRunning && !this.isPaused) return;

    // Reset system flags when starting fresh - timer should not carry pause attribution
    this.resetSystemFlags();

    this.isRunning = true;
    this.isPaused = false;

    this.intervalId = setInterval(() => {
      if (!this.isPaused) {
        this.tick();
      }
    }, 1000);

    this.validateFlagConsistency(); // Ensure clean state
  }

  /**
   * Check if audio should be allowed to control the timer
   * @returns {boolean} True if audio can control timer state
   */
  shouldAllowAudioControl() {
    return !this.isExternallyControlled;
  }

  /**
   * Resets all system-specific pause flags
   * @private
   */
  resetSystemFlags() {
    this.isPausedByAudio = false;
    this.isPausedByVisibilityTracker = false;
  }

  /**
   * Validates that pause flags are consistent with actual timer state
   * @private
   * @returns {boolean} True if state is consistent
   */
  validateFlagConsistency() {
    // If timer is not paused, no system should have pause flags set
    if (!this.isPaused) {
      const hasStaleFlags = this.isPausedByAudio || this.isPausedByVisibilityTracker;
      if (hasStaleFlags) {
        console.warn('[TIMER] State inconsistency detected: pause flags set but timer not paused');
        return false;
      }
    }
    return true;
  }

  /**
   * Pauses the timer
   * @param {Object} options - Additional options
   * @param {boolean} options.fromAudio - Whether this call is from audio feedback system
   * @param {boolean} options.fromVisibilityTracker - Whether this call is from visibility tracker
   */
  pause(options = {}) {
    if (!options.fromAudio && !options.fromVisibilityTracker) {
      this.isExternallyControlled = true;
      // Manual pause clears all system flags
      this.resetSystemFlags();
    } else if (options.fromAudio && !options.fromVisibilityTracker) {
      this.isPausedByAudio = true;
      // Clear visibility flag when audio takes control
      this.isPausedByVisibilityTracker = false;
    } else if (options.fromVisibilityTracker && !options.fromAudio) {
      this.isPausedByVisibilityTracker = true;
      // Clear audio flag when visibility takes control
      this.isPausedByAudio = false;
    }
    // Ignore combined case (both fromAudio and fromVisibilityTracker) - no flags set

    console.log(`[TIMER] pause() called. Previous state: isPaused=${this.isPaused}, isRunning=${this.isRunning}, currentSeconds=${this.currentSeconds}`);
    this.isPaused = true;
    console.log(`[TIMER] After pause(): isPaused=${this.isPaused}, isRunning=${this.isRunning}`);

    this.validateFlagConsistency(); // Ensure pause state is valid
  }

  /**
   * Resumes the timer
   * @param {Object} options - Additional options
   * @param {boolean} options.fromAudio - Whether this call is from audio feedback system
   * @param {boolean} options.fromVisibilityTracker - Whether this call is from visibility tracker
   */
  resume(options = {}) {
    if (!options.fromAudio && !options.fromVisibilityTracker) {
      this.isExternallyControlled = false;
    }
    console.log(`[TIMER] resume() called. Previous state: isPaused=${this.isPaused}, isRunning=${this.isRunning}, currentSeconds=${this.currentSeconds}`);

    // Handle combined flag scenarios explicitly - treat as invalid/ignored
    if (options.fromAudio && options.fromVisibilityTracker) {
      console.warn('[TIMER] Combined resume flags ignored - use single source or manual resume');
      return; // Combined calls do not resume
    }

    // Block cross-system resumes: audio cannot resume visibility pauses, visibility cannot resume audio pauses
    const isBlockedByCrossSystem = (options.fromAudio && this.isPausedByVisibilityTracker) || (options.fromVisibilityTracker && this.isPausedByAudio);

    // Only resume if not externally controlled, or if this call is not from external sources
    // AND not blocked by cross-system pause state
    if ((!this.isExternallyControlled || (!options.fromAudio && !options.fromVisibilityTracker)) && !isBlockedByCrossSystem) {
      this.isPaused = false;
      this.resetSystemFlags(); // Reset all system flags when resuming
    }

    console.log(`[TIMER] After resume(): isPaused=${this.isPaused}, isRunning=${this.isRunning}`);

    this.validateFlagConsistency(); // Ensure resume state is valid
  }

  /**
   * Stops the timer completely
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.resetSystemFlags(); // Reset all system-specific pause flags
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.validateFlagConsistency(); // Ensure state consistency
  }

  /**
   * Resets the timer to start time
   */
  reset() {
    // Store elapsed time from current session before resetting
    const elapsedTime = this.getTimeTaken();
    if (elapsedTime > 0) {
      // For reverse timers, store the difference (time consumed) rather than the current value
      if (this.config.timerType === "decrease") {
        this.elapsedTimes.push(this.config.startTime - this.currentSeconds);
      } else {
        this.elapsedTimes.push(elapsedTime);
      }
    }

    this.stop(); // This now resets system flags
    this.currentSeconds = this.config.startTime;
    this.updateDisplay();
    this.validateFlagConsistency(); // Ensure clean reset state
  }

  /**
   * Performs a complete hard reset of the timer state
   * Provides a clean slate restart with no memory of previous sessions
   */
  hardReset() {
    // Stop the timer completely (clear intervals, reset running/paused states)
    this.stop();

    // Reset currentSeconds to startTime
    this.currentSeconds = this.config.startTime;

    // Clear the entire elapsedTimes array
    this.elapsedTimes = [];

    // Reset external control state for truly clean slate
    this.isExternallyControlled = false;

    // Ensure all flags are reset (stop() already does this, but being explicit)
    this.resetSystemFlags();

    this.isRunning = false;
    this.isPaused = false;

    // Update the timer display
    this.updateDisplay();

    this.validateFlagConsistency(); // Verify complete state reset
  }

  /**
   * Gets the current time value
   */
  getCurrentTime() {
    return this.currentSeconds;
  }

  /**
   * Gets time taken (difference from start)
   */
  getTimeTaken() {
    return Math.abs(this.config.startTime - this.currentSeconds);
  }

  /**
   * Gets the current elapsed time
   * For decreasing timers, returns the adjusted time (time consumed)
   */
  getCurrentElapsedTime() {
    if (this.config.timerType === "decrease") {
      return this.config.startTime - this.currentSeconds;
    }
    return this.currentSeconds - this.config.startTime;
  }

  /**
   * Gets all elapsed times from previous sessions
   * If no elapsed times exist, returns current elapsed time in an array
   */
  getElapsedTimes() {
    if (this.elapsedTimes.length === 0) {
      return [this.getCurrentElapsedTime()];
    }
    return [...this.elapsedTimes]; // Return a copy to prevent external modification
  }

  /**
   * Updates timer configuration
   */
  updateConfig(newConfig) {
    const needsRerender =
      newConfig.showInActionBar !== undefined &&
      newConfig.showInActionBar !== this.config.showInActionBar;

    this.config = { ...this.config, ...newConfig };

    if (newConfig.seconds !== undefined) {
      this.currentSeconds = newConfig.seconds;
    }
    if (newConfig.startTime !== undefined) {
      this.config.startTime = newConfig.startTime;
    }
    if (newConfig.endTime !== undefined) {
      this.config.endTime = newConfig.endTime;
    }
    if (newConfig.timerType !== undefined) {
      this.config.timerType = newConfig.timerType;
    }
    if (newConfig.format !== undefined) {
      this.config.format = newConfig.format;
    }

    // If configuration changes significantly, validate that system flags are still relevant
    const hasSignificantConfigChange = newConfig.timerType !== undefined ||
                                      newConfig.startTime !== undefined ||
                                      newConfig.endTime !== undefined;

    if (hasSignificantConfigChange && this.isPaused) {
      // Configuration change while paused - system flags may no longer be relevant
      console.warn('[TIMER] Significant config change while paused - system flags may be stale');
      this.validateFlagConsistency();
    }

    if (needsRerender) {
      this.render();
    } else {
      this.updateDisplay();
    }
  }

  /**
   * Sets the current time
   */
  setTime(seconds) {
    this.currentSeconds = seconds;
    this.updateDisplay();
  }

  /**
   * Destroys the timer and cleans up
   */
  destroy() {
    this.stop(); // This resets system flags
    this.elapsedTimes = []; // Clear elapsed times history

    // Reset external control state
    this.isExternallyControlled = false;

    if (this.container) {
      this.container.innerHTML = "";
    }

    this.validateFlagConsistency(); // Final state check before destruction
  }
}

// Export for use in modules or make globally available
if (typeof module !== "undefined" && module.exports) {
  module.exports = TimerComponent;
} else {
  window.TimerComponent = TimerComponent;
}

} // Close the duplicate check block
