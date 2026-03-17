/**
 * FeedbackManager Type Definitions
 *
 * FeedbackManager is a unified feedback system for browser-based games.
 * It handles audio (regular + streaming), subtitles, and stickers in one cohesive API.
 *
 * Load via CDN:
 * <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
 *
 * @version 3.0.0
 */

declare namespace FeedbackManager {
  // ==================== Configuration Types ====================

  interface LoggerConfig {
    debug(message: string, context?: any): void;
    info(message: string, context?: any): void;
    warn(message: string, context?: any): void;
    error(message: string, context?: any): void;
  }

  interface TelemetryConfig {
    event(name: string, properties?: Record<string, any>): void;
  }

  interface SoundManagerConfig {
    /** Cache name for audio files. Default: 'mathai-audio-v1' */
    cacheName?: string;
    /** Enable debug logging. Default: false */
    enableLogs?: boolean;
    /** Auto-show permission popup when needed. Default: true */
    autoShowPermissionPopup?: boolean;
    /** Configuration for permission popup */
    popupConfig?: PopupConfig;
  }

  interface StreamManagerConfig {
    /** Volume level (0.0 to 1.0). Default: 1.0 */
    volume?: number;
    /** Buffer size for reading stream chunks. Default: 1024 */
    readBufferSize?: number;
    /** Maximum number of decoder workers to pool. Default: 10 */
    maxPoolSize?: number;
    /** Custom logger implementation */
    logger?: LoggerConfig;
    /** Custom telemetry implementation */
    telemetry?: TelemetryConfig;
  }

  // ==================== Popup Types ====================

  /**
   * Configuration for audio permission popup
   */
  interface PopupConfig {
    /** Icon URL (Lottie animation). Default: audio icon */
    icon?: string;
    /** Popup title. Default: 'Permission to play audio' */
    title?: string;
    /** Popup description. Default: 'Please click okay to enable sound' */
    description?: string;
    /** Primary button text. Default: 'Okay!' */
    primaryText?: string;
    /** Show secondary button. Default: false */
    hasSecondary?: boolean;
    /** Callback when popup is shown */
    onShow?: () => void;
  }

  interface PopupManager {
    /** Whether popup component is loaded */
    isLoaded: boolean;
    /** Whether popup is currently showing */
    isShowing: boolean;

    /**
     * Load the popup component
     * @returns true if loaded successfully
     */
    load(): Promise<boolean>;

    /**
     * Show audio permission popup
     * @param config Optional popup configuration
     * @returns true if user clicked okay
     */
    showAudioPermission(config?: PopupConfig): Promise<boolean>;

    /**
     * Hide the popup
     */
    hide(): void;
  }

  // ==================== Subtitle Types ====================

  /**
   * Subtitle options for feedback
   */
  interface SubtitleOptions {
    /** Subtitle text (supports markdown: **bold**, *italic*) */
    text: string;
    /** Duration in seconds. Default: auto-calculated from audio duration */
    duration?: number;
    /** Optional activity ID for analytics */
    id?: string;
    /** Optional activity title for analytics */
    title?: string;
  }

  /**
   * Simple subtitle configuration (just text)
   */
  type SubtitleConfig = string | SubtitleOptions;

  // ==================== Sticker Types ====================

  /**
   * Sticker options for feedback
   */
  interface StickerOptions {
    /** Sticker URL (Lottie animation JSON) */
    sticker: string;
    /** Duration in seconds. Default: auto-calculated from audio duration */
    duration?: number;
    /** Loop the animation. Default: false */
    loop?: boolean;
    /** Custom position */
    position?: {
      top?: string;
      bottom?: string;
      left?: string;
      right?: string;
    };
  }

  /**
   * Simple sticker configuration (just URL)
   */
  type StickerConfig = string | StickerOptions;

  // ==================== Feedback Components Manager ====================

  interface FeedbackComponentsManager {
    /** Whether subtitle component is loaded */
    subtitleLoaded: boolean;
    /** Whether sticker component is loaded */
    stickerLoaded: boolean;
    /** Whether Lottie player is loaded */
    lottieLoaded: boolean;

    /**
     * Load Lottie Player (required for stickers)
     * @returns true if loaded successfully
     */
    loadLottie(): Promise<boolean>;

    /**
     * Load Subtitle Component
     * @returns true if loaded successfully
     */
    loadSubtitle(): Promise<boolean>;

    /**
     * Load Sticker Component
     * @returns true if loaded successfully
     */
    loadSticker(): Promise<boolean>;

    /**
     * Load all feedback components
     * @returns Object with load status for each component
     */
    loadAll(): Promise<{ subtitle: boolean; sticker: boolean }>;

    /**
     * Show subtitle with safe error handling
     * @param options Subtitle options
     * @returns true if shown successfully
     */
    showSubtitle(options: SubtitleOptions): boolean;

    /**
     * Hide subtitle with safe error handling
     * @returns true if hidden successfully
     */
    hideSubtitle(): boolean;

    /**
     * Show sticker with safe error handling
     * @param options Sticker options
     * @returns true if shown successfully
     */
    showSticker(options: StickerOptions): boolean;

    /**
     * Hide sticker with safe error handling
     * @returns true if hidden successfully
     */
    hideSticker(): boolean;

    /**
     * Show feedback (subtitle + sticker) with auto-hide after duration
     * @param options Feedback options
     * @param audioDuration Audio duration for timing
     * @returns Result object with show status
     */
    showFeedback(
      options: {
        subtitle?: SubtitleConfig;
        sticker?: StickerConfig;
      },
      audioDuration: number
    ): {
      subtitle: boolean;
      sticker: boolean;
      duration: number;
    };

    /**
     * Hide all feedback (subtitle + sticker)
     */
    hideAll(): void;
  }

  // ==================== Audio Item Types ====================

  interface AudioItem {
    /** Unique identifier for this audio */
    id: string;
    /** URL to the audio file */
    url: string;
  }

  interface PreloadResult {
    /** Audio ID */
    id: string;
    /** Status of preload operation */
    status: 'ok' | 'error';
    /** Error message if status is 'error' */
    error?: string;
  }

  interface PlayResult {
    /** Audio ID */
    id: string;
    /** Status of play operation */
    status: 'ok' | 'error' | 'missing' | 'dropped' | 'locked' | 'preempted' | 'timeout';
    /** Error message if status is 'error' */
    error?: string;
  }

  interface PlayOptions {
    /** Volume level (0.0 to 1.0) */
    volume?: number;
    /** Playback rate (0.5 to 2.0) */
    rate?: number;
    /** Detune in cents */
    detune?: number;
    /** Priority for preemption (higher = more important). Default: 0 */
    priority?: number;
    /** Source that triggered this play (for debugging) */
    triggerSource?: string;
    /** Show popup if needed. Default: follows autoShowPermissionPopup config */
    showPopup?: boolean;
    /** Subtitle to show during audio playback */
    subtitle?: SubtitleConfig;
    /** Sticker to show during audio playback */
    sticker?: StickerConfig;
  }

  interface UnlockOptions {
    /** Show popup if audio needs unlocking. Default: follows autoShowPermissionPopup */
    showPopup?: boolean;
    /** Custom popup configuration */
    popupConfig?: PopupConfig;
  }

  interface SoundState {
    /** Whether audio context has been unlocked */
    unlocked: boolean;
    /** Whether unlock has been attempted */
    unlockAttempted: boolean;
    /** Play mode (always 'mono' for sequential playback) */
    playMode: 'mono';
    /** ID of currently playing sound */
    currentlyPlaying: string | null;
    /** Number of sounds loaded */
    soundsLoaded: number;
    /** Array of all loaded sound IDs */
    sounds: string[];
  }

  interface PreloadCriticalOptions {
    /** Callback for progress updates (progress: 0-1, id: current audio) */
    onProgress?: (progress: number, id: string) => void;
    /** Callback for errors (id: failed audio, error: Error) */
    onError?: (id: string, error: Error) => void;
    /** Number of concurrent downloads. Default: 4 */
    concurrency?: number;
  }

  // ==================== Stream Types ====================

  interface StreamCallbacks {
    /** Called when stream completes playback */
    complete?(): void;
    /** Called when stream starts playing */
    onPlay?(): void;
    /** Called when stream encounters an error */
    error?(message: string): void;
  }

  interface StreamOptions {
    /** Timeout (ms) for stream playback. Default: 0 (no timeout) */
    timeout?: number;
    /** Subtitle to show during stream playback */
    subtitle?: SubtitleConfig;
    /** Sticker to show during stream playback */
    sticker?: StickerConfig;
  }

  interface StreamPlayingInfo {
    /** Stream ID */
    id: string;
    /** Remaining playback time in seconds */
    remaining?: number;
  }

  // ==================== SoundManager Interface ====================

  interface SoundManager {
    /**
     * Check if audio needs unlocking
     * @returns true if unlock() needs to be called
     *
     * @example
     * if (FeedbackManager.sound.needsUnlock()) {
     *   await FeedbackManager.sound.unlock();
     * }
     */
    needsUnlock(): boolean;

    /**
     * Check if user can play audio (has interacted with page)
     * @returns true if audio can be played without popup
     *
     * @example
     * const canPlay = FeedbackManager.sound.canPlayAudio();
     * if (!canPlay) {
     *   // Show custom UI to get user interaction
     * }
     */
    canPlayAudio(): boolean;

    /**
     * Unlock audio context (required for browser autoplay policy)
     * Optionally shows permission popup if needed
     *
     * @param options Unlock options
     * @returns true if unlocked successfully
     *
     * @example
     * // Auto-show popup if needed (default behavior)
     * await FeedbackManager.sound.unlock();
     *
     * @example
     * // Never show popup
     * await FeedbackManager.sound.unlock({ showPopup: false });
     *
     * @example
     * // Custom popup config
     * await FeedbackManager.sound.unlock({
     *   popupConfig: {
     *     title: 'Enable Sound?',
     *     description: 'We need permission to play audio'
     *   }
     * });
     */
    unlock(options?: UnlockOptions): Promise<boolean>;

    /**
     * Request audio permission with popup (explicit)
     * Always shows popup regardless of config
     *
     * @param popupConfig Optional popup configuration
     * @returns true if user granted permission
     *
     * @example
     * const granted = await FeedbackManager.sound.requestPermission({
     *   title: 'Enable Game Audio',
     *   description: 'This game requires audio'
     * });
     */
    requestPermission(popupConfig?: PopupConfig): Promise<boolean>;

    /**
     * Preload audio files for instant playback
     *
     * @param list Array of audio items to preload
     * @returns Array of results for each preload attempt
     *
     * @example
     * const results = await FeedbackManager.sound.preload([
     *   { id: 'tap', url: 'https://example.com/tap.mp3' },
     *   { id: 'correct', url: 'https://example.com/correct.mp3' }
     * ]);
     */
    preload(list: AudioItem[]): Promise<PreloadResult[]>;

    /**
     * Play a preloaded sound with optional subtitle and sticker
     * Automatically stops currently playing sound (mono mode)
     * Auto-unlocks audio if needed (shows popup if configured)
     *
     * @param id ID of the sound to play
     * @param options Optional playback settings + feedback (subtitle/sticker)
     * @returns Result of play operation
     *
     * @example
     * // Simple play
     * await FeedbackManager.sound.play('tap');
     *
     * @example
     * // With subtitle
     * await FeedbackManager.sound.play('correct', {
     *   subtitle: 'Great job!'
     * });
     *
     * @example
     * // With subtitle and sticker
     * await FeedbackManager.sound.play('correct', {
     *   subtitle: {
     *     text: '**Excellent!** You got it right!',
     *     duration: 3
     *   },
     *   sticker: {
     *     image: 'https://cdn.mathai.ai/mathai-assets/lottie/star-sparkle.json',
     *     loop: false,
     *     duration: 3,
     *     type: 'IMAGE_GIF'
     *   },
     *   priority: 10
     * });
     *
     * @example
     * // Full control
     * await FeedbackManager.sound.play('correct', {
     *   volume: 0.8,
     *   rate: 1.2,
     *   priority: 10,
     *   subtitle: 'Perfect!',
     *   sticker: 'https://cdn.mathai.com/stickers/trophy.json'
     * });
     */
    play(id: string, options?: PlayOptions): Promise<PlayResult>;

    /**
     * Play a sound and wait for it to complete
     *
     * @param id ID of the sound to play
     * @param options Optional playback settings + feedback
     * @returns Result of play operation
     */
    playAndWait(id: string, options?: PlayOptions): Promise<PlayResult>;

    /**
     * Stop all currently playing sounds
     */
    stopAll(): void;

    /**
     * Pause currently playing sound
     * Preserves playback position for resume
     * @returns true if a sound was paused
     */
    pause(): boolean;

    /**
     * Resume paused sound
     * Continues from where it was paused
     * @returns true if a sound was resumed
     */
    resume(): Promise<boolean>;

    /**
     * Get duration of a preloaded sound
     * @param id Sound ID
     * @returns Duration in seconds, or null if not found
     */
    getDuration(id: string): number | null;

    /**
     * Check if a sound is loaded
     * @param id Sound ID
     * @returns true if sound is loaded and ready
     */
    has(id: string): boolean;

    /**
     * Get ID of currently playing sound
     * @returns Sound ID or null
     */
    getCurrentlyPlaying(): string | null;

    /**
     * Clear all cooldown timers
     * Allows immediate replay of sounds that were recently played
     */
    clearCooldowns(): void;

    /**
     * Get current state of sound manager
     * @returns State object with all loaded sounds
     *
     * @example
     * const state = FeedbackManager.sound.getState();
     * console.log('Unlocked:', state.unlocked);
     * console.log('Loaded sounds:', state.sounds);
     * console.log('Currently playing:', state.currentlyPlaying);
     */
    getState(): SoundState;
  }

  // ==================== StreamManager Interface ====================

  interface StreamManager {
    /**
     * Initialize streaming system (loads decoders, creates audio context)
     * Called automatically on first use, but can be called early to preload
     *
     * @example
     * // Optional: preload streaming system during game load
     * await FeedbackManager.stream.initialize();
     */
    initialize(): Promise<void>;

    /**
     * Add a stream from URL
     *
     * @param id Unique identifier for this stream
     * @param url URL to the streaming audio
     * @param loaded Optional callback when stream is ready
     * @returns true if stream was added successfully
     *
     * @example
     * await FeedbackManager.stream.add('bgm', 'https://example.com/music.opus');
     * FeedbackManager.stream.play('bgm');
     */
    add(id: string, url: string, loaded?: () => void): Promise<boolean>;

    /**
     * Add a stream from a Fetch Response
     * Used for dynamic audio generation that returns streams
     *
     * @param id Unique identifier for this stream
     * @param response Fetch Response object with audio stream
     * @param loaded Optional callback when stream is ready
     * @returns true if stream was added successfully
     *
     * @example
     * const response = await fetch('https://api.example.com/generate-audio?text=Hello');
     * await FeedbackManager.stream.addFromResponse('dynamic', response);
     * FeedbackManager.stream.play('dynamic');
     */
    addFromResponse(id: string, response: Response, loaded?: () => void): Promise<boolean>;

    /**
     * Play a stream with optional subtitle and sticker
     *
     * @param id Stream ID
     * @param callbacks Optional callbacks for stream events
     * @param options Optional playback settings + feedback
     * @returns true if stream started playing
     *
     * @example
     * // With subtitle and sticker
     * FeedbackManager.stream.play('bgm', {
     *   complete: () => console.log('Stream finished'),
     *   error: (msg) => console.error('Stream error:', msg)
     * }, {
     *   timeout: 30000,
     *   subtitle: 'Now playing background music',
     *   sticker: 'https://cdn.mathai.com/stickers/music.json'
     * });
     */
    play(id: string, callbacks?: StreamCallbacks, options?: StreamOptions): boolean;

    /**
     * Stop a playing stream
     * @param id Stream ID
     * @returns true if stream was stopped
     */
    stop(id: string): boolean;

    /**
     * Remove a stream and free resources
     * @param id Stream ID
     * @returns true if stream was removed
     */
    remove(id: string): boolean;

    /**
     * Pause a stream
     * @param id Stream ID
     * @returns true if stream was paused
     */
    pause(id: string): boolean;

    /**
     * Resume a paused stream
     * @param id Stream ID
     * @returns true if stream was resumed
     */
    resume(id: string): boolean;

    /**
     * Pause all streams
     * @returns true if any streams were paused
     */
    pauseAll(): boolean;

    /**
     * Resume all paused streams
     * @returns true if any streams were resumed
     */
    resumeAll(): boolean;

    /**
     * Get all stream IDs
     * @returns Array of stream IDs
     */
    getAll(): string[];

    /**
     * Check if a stream is currently playing
     * @param id Stream ID
     * @returns true if stream is playing
     */
    isPlaying(id: string): boolean;

    /**
     * Check if a stream exists
     * @param id Stream ID
     * @returns true if stream exists
     */
    has(id: string): boolean;

    /**
     * Stop all streams
     */
    stopAll(): void;

    /**
     * Remove all streams and free resources
     */
    removeAll(): void;

    /**
     * Get currently playing streams
     * @returns Array of playing stream info
     */
    getCurrentPlaying(): StreamPlayingInfo[];

    /**
     * Set master volume for all streams
     * @param volume Volume level (0.0 to 1.0)
     */
    setVolume(volume: number): void;

    /**
     * Get current master volume
     * @returns Volume level (0.0 to 1.0)
     */
    getVolume(): number;

    /**
     * Dispose of all resources (decoders, audio context, etc.)
     * Call when completely done with streaming
     */
    dispose(): Promise<void>;
  }

  // ==================== Main FeedbackManager Interface ====================

  interface FeedbackManagerInstance {
    /** Regular audio manager (HTMLAudioElement-based) */
    sound: SoundManager;

    /** Streaming audio manager (Opus/Ogg decoder-based) */
    stream: StreamManager;

    /** Popup manager for audio permissions */
    popup: PopupManager;

    /** Feedback components manager (subtitle + sticker) */
    feedback: FeedbackComponentsManager;

    /**
     * 🚨 MANDATORY: Initialize FeedbackManager
     *
     * Must be called once as soon as the DOM is rendered, before using any FeedbackManager features.
     * Loads audio streaming, subtitle, and sticker components.
     *
     * @example
     * // Call immediately when DOM is ready
     * document.addEventListener('DOMContentLoaded', async () => {
     *   await FeedbackManager.init();
     *   // Now you can use FeedbackManager
     * });
     *
     * @example
     * // Or in your game initialization
     * async function initGame() {
     *   await FeedbackManager.init();
     *   // Rest of your game setup...
     * }
     */
    init(): Promise<void>;

    /**
     * Check if audio needs unlocking
     * @returns true if unlock() needs to be called
     *
     * @example
     * if (FeedbackManager.needsUnlock()) {
     *   // Show UI to prompt user interaction
     * }
     */
    needsUnlock(): boolean;

    /**
     * Check if user can play audio without popup
     * @returns true if audio can play
     *
     * @example
     * const canPlay = FeedbackManager.canPlayAudio();
     */
    canPlayAudio(): boolean;

    /**
     * Unlock audio context (convenience method)
     * Calls sound.unlock() internally
     * Optionally shows permission popup if needed
     *
     * @param options Unlock options
     * @returns true if unlocked successfully
     *
     * @example
     * // Auto-show popup if needed
     * await FeedbackManager.unlock();
     *
     * @example
     * // Custom popup
     * await FeedbackManager.unlock({
     *   popupConfig: {
     *     title: 'Enable Audio',
     *     description: 'Click to enable game sounds'
     *   }
     * });
     */
    unlock(options?: UnlockOptions): Promise<boolean>;

    /**
     * Request audio permission with popup (explicit)
     * Always shows popup regardless of config
     *
     * @param popupConfig Optional popup configuration
     * @returns true if user granted permission
     *
     * @example
     * const granted = await FeedbackManager.requestPermission({
     *   title: 'Enable Sound',
     *   icon: 'https://example.com/audio-icon.json'
     * });
     */
    requestPermission(popupConfig?: PopupConfig): Promise<boolean>;

    /**
     * Load popup component (pre-load if needed)
     * @returns true if loaded successfully
     *
     * @example
     * // Pre-load during game initialization
     * await FeedbackManager.loadPopup();
     */
    loadPopup(): Promise<boolean>;

    /** FeedbackManager version */
    version: string;
  }
}

// ==================== Global Declarations ====================

/**
 * Global FeedbackManager instance
 * Available after loading the FeedbackManager script
 */
declare const FeedbackManager: FeedbackManager.FeedbackManagerInstance;

/**
 * Backward compatibility alias for AudioKit
 * @deprecated Use FeedbackManager instead
 */
declare const AudioKit: FeedbackManager.FeedbackManagerInstance;

/**
 * Global debug helper - test a specific audio by ID
 * @param id Audio ID to test
 */
declare function testAudio(id: string): void;

/**
 * Global debug helper - test all loaded audio in sequence
 */
declare function testAllAudio(): Promise<void>;

/**
 * Global debug helper - get current audio state
 * @returns Current state of sound manager
 */
declare function getAudioState(): FeedbackManager.SoundState | null;

// ==================== Window Interface Extension ====================

interface Window {
  FeedbackManager: FeedbackManager.FeedbackManagerInstance;
  AudioKit: FeedbackManager.FeedbackManagerInstance;
  testAudio: typeof testAudio;
  testAllAudio: typeof testAllAudio;
  getAudioState: typeof getAudioState;
}
