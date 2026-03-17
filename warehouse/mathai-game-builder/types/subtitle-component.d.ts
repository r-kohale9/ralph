/**
 * SubtitleComponent Type Definitions
 *
 * A vanilla JavaScript component for displaying feedback/subtitles at the bottom of the screen.
 * Supports markdown-style formatting, auto-hide, callbacks, and analytics integration.
 *
 * Load via CDN (via Components package):
 * <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
 *
 * @version 1.0.0
 */

declare namespace SubtitleComponent {
  // ==================== Configuration Types ====================

  /**
   * Position configuration for the subtitle container
   */
  interface PositionConfig {
    /** Distance from bottom of viewport. Default: "60px" */
    bottom?: string;
    /** Maximum width of subtitle container. Default: "280px" */
    maxWidth?: string;
  }

  /**
   * Custom text renderer function
   * Converts input text to HTML (with markdown support by default)
   */
  type TextRenderer = (text: string) => string;

  /**
   * Logging function for anomaly detection and debugging
   */
  type DumpLogsFunction = (data: {
    action: string;
    feedback: FeedbackData | null;
    elapsed: number;
  }) => void;

  /**
   * Mixpanel tracking function
   */
  type MixpanelTrackFunction = (
    event: string,
    properties: Record<string, any>
  ) => void;

  /**
   * Evaluation area function (used to skip player_2 in multiplayer)
   */
  type EvaluationAreaFunction = () => string | null;

  /**
   * Callback when subtitle is shown
   */
  type OnShowCallback = (feedback: FeedbackData | null) => void;

  /**
   * Callback when subtitle is hidden
   */
  type OnHideCallback = (feedback: FeedbackData | null) => void;

  /**
   * Configuration object for SubtitleComponent
   */
  interface Config {
    /** Custom text renderer (default supports markdown) */
    renderer?: TextRenderer;
    /** Logging function for anomaly detection */
    dumpLogs?: DumpLogsFunction;
    /** Mixpanel tracking function */
    mixpanelTrack?: MixpanelTrackFunction;
    /** Evaluation area function (skip player_2) */
    evaluationArea?: EvaluationAreaFunction;
    /** Called when subtitle is shown */
    onShow?: OnShowCallback;
    /** Called when subtitle is hidden */
    onHide?: OnHideCallback;
    /** Position configuration */
    position?: PositionConfig;
  }

  // ==================== Feedback Data Types ====================

  /**
   * Internal feedback data structure
   */
  interface FeedbackData {
    /** Subtitle text content */
    text: string;
    /** Duration in seconds */
    duration: number;
    /** Callback when this subtitle hides */
    onHide: (() => void) | null;
    /** Optional activity ID (for Mixpanel tracking) */
    id: string | null;
    /** Optional activity title (for Mixpanel tracking) */
    title: string | null;
  }

  /**
   * Options for showing a subtitle
   */
  interface ShowOptions {
    /** Subtitle text (supports markdown: **bold**, *italic*, etc.) */
    text: string;
    /** Duration in seconds. Default: 3 */
    duration?: number;
    /** Called when this subtitle is hidden */
    onHide?: () => void;
    /** Optional activity ID for analytics */
    id?: string;
    /** Optional activity title for analytics */
    title?: string;
  }

  /**
   * Current state of the subtitle component
   */
  interface State {
    /** Whether subtitle is currently visible */
    isVisible: boolean;
    /** Current feedback data (null if not visible) */
    currentFeedback: FeedbackData | null;
    /** Time elapsed since subtitle was shown (ms) */
    timeElapsed: number;
  }

  // ==================== SubtitleComponent Class ====================

  /**
   * SubtitleComponent instance
   * Create with: new SubtitleComponent.SubtitleComponent(config)
   */
  class SubtitleComponentInstance {
    constructor(config?: Config);

    /**
     * Show a subtitle
     *
     * @param options Subtitle options
     *
     * @example
     * subtitle.show({
     *   text: "Great job!",
     *   duration: 3,
     *   onHide: () => console.log('Hidden')
     * });
     */
    show(options: ShowOptions): void;

    /**
     * Hide the currently visible subtitle
     * Triggers onHide callbacks
     */
    hide(): void;

    /**
     * Clear the auto-hide timeout
     * Subtitle will remain visible until hide() is called
     */
    clearTimeout(): void;

    /**
     * Extend the duration of the current subtitle
     *
     * @param additionalSeconds Additional seconds to show subtitle
     *
     * @example
     * subtitle.extendDuration(3); // Keep showing for 3 more seconds
     */
    extendDuration(additionalSeconds: number): void;

    /**
     * Update the text of the currently visible subtitle
     * Does nothing if no subtitle is showing
     *
     * @param newText New text content
     *
     * @example
     * subtitle.updateText("**Updated!** New message");
     */
    updateText(newText: string): void;

    /**
     * Get current state of the subtitle
     *
     * @returns Current state object
     *
     * @example
     * const state = subtitle.getState();
     * if (state.isVisible) {
     *   console.log('Showing:', state.currentFeedback.text);
     * }
     */
    getState(): State;

    /**
     * Check if subtitle is currently showing
     *
     * @returns true if visible
     */
    isShowing(): boolean;

    /**
     * Destroy the component and remove from DOM
     */
    destroy(): void;
  }

  // ==================== Global API ====================

  /**
   * Global SubtitleComponent API
   * Provides both singleton and factory methods
   */
  interface API {
    /**
     * Get or create singleton instance
     * First call creates the instance, subsequent calls return the same instance
     *
     * @param config Optional configuration (only used on first call)
     * @returns Singleton instance
     *
     * @example
     * const subtitle = SubtitleComponent.getInstance();
     * subtitle.show({ text: "Hello" });
     */
    getInstance(config?: Config): SubtitleComponentInstance;

    /**
     * Create a new instance (non-singleton)
     * Use when you need multiple independent subtitle components
     *
     * @param config Configuration
     * @returns New instance
     *
     * @example
     * const subtitle1 = SubtitleComponent.create({ position: { bottom: '80px' } });
     * const subtitle2 = SubtitleComponent.create({ position: { bottom: '20px' } });
     */
    create(config?: Config): SubtitleComponentInstance;

    /**
     * Show subtitle using global singleton instance
     * Creates singleton if it doesn't exist
     *
     * @param options Subtitle options
     *
     * @example
     * SubtitleComponent.show({
     *   text: "**Great job!** You got it right ✨",
     *   duration: 3
     * });
     */
    show(options: ShowOptions): void;

    /**
     * Hide subtitle using global singleton instance
     */
    hide(): void;

    /**
     * Clear timeout using global singleton instance
     */
    clearTimeout(): void;

    /**
     * Extend duration using global singleton instance
     *
     * @param seconds Additional seconds
     */
    extendDuration(seconds: number): void;

    /**
     * Update text using global singleton instance
     *
     * @param text New text
     */
    updateText(text: string): void;

    /**
     * Get state using global singleton instance
     *
     * @returns Current state or null if no instance
     */
    getState(): State | null;

    /**
     * Check if subtitle is showing using global singleton instance
     *
     * @returns true if visible
     */
    isShowing(): boolean;

    /**
     * Configure global singleton instance
     * Creates instance if it doesn't exist
     *
     * @param config Configuration to apply
     * @returns Configured instance
     *
     * @example
     * SubtitleComponent.configure({
     *   dumpLogs: (data) => console.log('Log:', data),
     *   mixpanelTrack: (event, props) => mixpanel.track(event, props)
     * });
     */
    configure(config: Config): SubtitleComponentInstance;

    /**
     * Destroy global singleton instance
     */
    destroy(): void;

    /**
     * Constructor for advanced usage
     * Use SubtitleComponent.create() instead for most cases
     */
    SubtitleComponent: typeof SubtitleComponentInstance;
  }
}

// ==================== Global Declaration ====================

/**
 * Global SubtitleComponent API
 * Available after loading the SubtitleComponent script
 */
declare const SubtitleComponent: SubtitleComponent.API;

// ==================== Window Interface Extension ====================

interface Window {
  SubtitleComponent: SubtitleComponent.API;
}
