/**
 * APIHelper - MathAI Core API Communication
 *
 * Handles communication with the MathAI Core API for game session management.
 * Provides methods for submitting game results, configuring endpoints, and error handling.
 *
 * 🚨 MANDATORY for ALL games - required for backend communication
 */

declare class APIHelper {
  /**
   * Create a new APIHelper instance
   * @param config - Configuration options
   */
  constructor(config?: APIHelperConfig);

  /**
   * Submit a completed game session to the backend
   * @param payload - Game session payload
   * @returns Promise resolving to API response
   */
  submitResults(payload: GameSessionPayload): Promise<any>;

  /**
   * Get student data from the backend
   * @param userId - Optional user ID to fetch specific student data
   * @returns Promise resolving to student data
   */
  getStudentData(userId?: string): Promise<any>;

  /**
   * Register an error callback function
   * @param callback - Function called when API errors occur
   */
  onError(callback: (error: Error) => void): void;

  /**
   * Update API configuration
   * @param newConfig - New configuration options to merge
   */
  configure(newConfig: Partial<APIHelperConfig>): void;

  /**
   * Get current API configuration
   * @returns Current configuration object
   */
  getConfig(): APIHelperConfig;
}

/**
 * APIHelper configuration options
 */
interface APIHelperConfig {
  /** Base URL for API requests */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default headers for all requests */
  headers?: Record<string, string>;
  /** Default API endpoint path */
  endpoint?: string;
}

/**
 * Game session payload for submission
 */
interface GameSessionPayload {
  /** Unique session identifier */
  session_id: string;
  /** Game identifier */
  game_id: string;
  /** Final metrics object */
  metrics: GameMetrics;
  /** Attempt history array */
  attempts: AttemptRecord[];
  /** Completion timestamp (milliseconds) */
  completed_at: number;
  /** Optional: User identifier */
  user_id?: string;
  /** Optional: Content set identifier */
  content_set_id?: string;
}

/**
 * Game metrics object
 */
interface GameMetrics {
  /** Final score achieved */
  score?: number;
  /** Time taken to complete (seconds) */
  time?: number;
  /** Accuracy percentage (0-100) */
  accuracy?: number;
  /** Whether game was completed successfully */
  completed?: boolean;
  /** Number of retries/attempts */
  retries?: number;
  /** Any custom metrics */
  [key: string]: any;
}

/**
 * Individual attempt record
 */
interface AttemptRecord {
  /** Question/problem identifier */
  question_id?: string | number;
  /** Whether answer was correct */
  correct: boolean;
  /** Time taken for this attempt (seconds) */
  time: number;
  /** User's answer */
  answer?: any;
  /** Additional attempt metadata */
  [key: string]: any;
}

/**
 * Global APIHelper instance (available after helpers package loads)
 */
declare const APIHelper: {
  new (config?: APIHelperConfig): APIHelper;
};

/**
 * MathAIHelpers namespace (available after helpers package loads)
 */
declare const MathAIHelpers: {
  APIHelper: typeof APIHelper;
  VisibilityTracker: any; // From visibility-tracker package
  version: string;
};
