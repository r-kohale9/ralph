/**
 * StoriesComponent - Advanced Story Navigation Component
 *
 * A comprehensive component for handling story-based navigation with JSON format support.
 * Supports compute functions, global context, duration tracking, asset management,
 * audio integration, and responsive rendering.
 *
 * Version: 2.0.0
 * @class StoriesComponent
 */

(function (window) {
  'use strict';

  // Skip if already loaded
  if (typeof window.StoriesComponent !== "undefined") {
    console.log("[StoriesComponent] Already loaded, skipping duplicate execution");
    return;
  }

  /**
   * StoriesComponent Class
   *
   * Manages sequential story navigation with support for:
   * - Story block JSON parsing (data.children array format)
   * - Compute functions for dynamic navigation
   * - Global context management
   * - Duration tracking with tab visibility handling
   * - Asset preloading and duration calculation
   * - Audio integration with FeedbackManager
   * - Event handling for buttons and inputs
   * - Responsive positioning and rendering
   */
  class StoriesComponent {
    /**
     * Constructor
     * @param {string} containerId - DOM element ID for the container
     * @param {Object} config - Configuration object
     * @param {number|string} config.storyBlockId - Story block ID to fetch from GraphQL (required)
     * @param {Object} config.globalContext - Initial global variables (value_map format)
     * @param {Function} config.onStoryChange - Callback(index, direction, storyData)
     * @param {Function} config.onComplete - Callback(data)
     * @param {Function} config.onButtonClick - Callback(name, action, storyIndex)
     * @param {Function} config.onInputChange - Callback(name, value, storyIndex)
     * @param {Function} config.onError - Callback(error)
     */
    constructor(containerId, config = {}) {
      // Container validation
      this.container = document.getElementById(containerId);
      if (!this.container) {
        throw new Error(`Container with id "${containerId}" not found`);
      }

      // Configuration
      this.config = {
        ttsEndpoint: 'https://test3-api.homeworkapp.ai/test/ts',
        storyBlockId: null,
        globalContext: { value_map: {} },
        onStoryChange: null,
        onComplete: null,
        onButtonClick: null,
        onInputChange: null,
        onError: null,
        trackDuration: true,
        pauseOnTabSwitch: true,
        preloadAssets: true,
        enableAudio: true,
        ...config,
        showProgress: true
      };

      // Validate storyBlockId
      if (!this.config.storyBlockId) {
        throw new Error('storyBlockId is required');
      }

      // State management
      this.stories = [];
      this.storiesMap = {}; // Map story names to { index, inputs }
      this.currentStoryIndex = -1; // Match StoriesBlock implementation (-1 initial, then 0)
      this.storiesArray = []; // History of completed stories with inputs
      this.history = []; // Navigation history for back functionality
      this.isLoading = false;
      this.isPaused = false;
      this.isShowingPermissionPopup = false; // Track permission popup state

      // Backward compatibility: currentIndex points to currentStoryIndex
      Object.defineProperty(this, 'currentIndex', {
        get: function () {
          return this.currentStoryIndex;
        },
        set: function (value) {
          this.currentStoryIndex = value;
        },
        enumerable: true,
        configurable: true
      });

      // Analytics integration (optional - pass instance via config or use global)
      this.analytics = config.analytics || window.analyticsManager || null;
      this.analyticsEnabled = !!this.analytics;

      // Global context (merged with initial config)
      this.globalContext = {
        value_map: {
          ...(this.config.globalContext?.value_map || {})
        }
      };

      // Input state management
      this.inputs = {};

      // Duration tracking (refs in StoriesBlock)
      this.storyDurationRef = {}; // Duration per story index
      this.durationData = {
        perStory: {}, // Duration per story index (legacy compat)
        total: 0,
        inactive: 0,
        startTime: null,
        currentStoryStartTime: null,
        currentStoryInactiveDuration: 0,
        totalStoryInactiveTabDuration: 0,
        tabHiddenTime: null
      };

      // Asset duration cache (assetsDuration ref in StoriesBlock)
      this.assetDurations = {};

      // Container dimensions tracking
      this.containerDimensions = {
        width: 0,
        height: 0
      };

      // Event handlers
      this.visibilityHandler = null;
      this.resizeHandler = null;

      // Audio integration
      this.audioManager = null;
      this.currentAudioId = null;

      // Media completion tracking (for auto-advance when both video and audio exist)
      this.mediaEnded = {
        video: false,
        audio: false
      };

      // Audio generation state (TTS for dynamic text with @@variables@@)
      this.genAudioMap = []; // Map indicating which stories need audio generation at each index
      this.generateAudioMap = null; // Currently generating stories
      this.loadingGeneratedAudio = false; // Loading state flag
      this.storyStoppedAt = null; // Navigation state during generation

      // Media load error state (matching mathai-client pattern)
      this.isContentError = false; // Media load failure flag
      this.isNetworkOffline = false; // Network offline flag
      this.errorCount = 0; // Retry attempt counter
      this.failedMediaUrls = []; // Track which URLs failed
      this.errorPopupShowing = false; // Prevent multiple popups

      // Navigation debounce state (prevent rage clicking)
      this.isNavigating = false; // Flag to prevent rapid navigation
      this.navigationCooldown = 300; // Cooldown period in milliseconds

      // Retry configuration
      this.maxRetries = 2; // Maximum retry attempts before skipping story
      this.retryingStoryIndex = null; // Track which story is being retried
      this.isRetrying = false; // Flag to track if currently in retry flow

      // Renderer and utility functions (inline or imported)
      this.initializeUtilities();

      // Initialize component
      this.init();
    }

    /**
     * Initialize utilities and renderers
     * These can be loaded from external files or defined inline
     */
    initializeUtilities() {
      // Utility functions for compute execution, positioning, etc.
      this.utils = {
        /**
         * Sanitize and prepare dynamic function code for execution
         * Based on StoryBlock/index.tsx safeDynamicFunction (lines 656-683)
         * @param {string} functionString - Raw function string from compute_functions
         * @returns {string} Sanitized function body ready for execution
         */
        safeDynamicFunction: functionString => {
          try {
            // Extract function body (between first { and last })
            const bodyStartIndex = functionString.indexOf('{') + 1;
            const bodyEndIndex = functionString.lastIndexOf('}');
            const functionBody = functionString.substring(bodyStartIndex, bodyEndIndex);

            // Return the function body for execution
            return functionBody;
          } catch (error) {
            console.error('[StoriesComponent] Error sanitizing function:', error);
            return '';
          }
        },

        /**
         * Execute compute function with proper context
         * Matches StoryBlock/index.tsx handleJump implementation (lines 656-683)
         * @param {string} computeCode - Function code to execute
         * @param {Object} params - Parameters for compute function
         * @returns {*} Result of compute function (story name or "next")
         */
        executeComputeFunction: (computeCode, params = {}) => {
          try {
            // Create a safe execution context
            const { history = {}, inputs = {}, global_context_variables = {}, publishEvent = () => { } } = params;

            // Sanitize function body
            const functionBody = this.utils.safeDynamicFunction(computeCode);

            // Create parameter keys array (matching StoryBlock implementation)
            const paramsKeys = ['history', 'inputs', 'global_context_variables', 'publishEvent'];

            // Create parameter values array
            const paramsValue = [history, inputs, global_context_variables, publishEvent];

            // Create and execute function
            const getNext = new Function(...paramsKeys, functionBody);
            const result = getNext(...paramsValue);

            return result;
          } catch (error) {
            console.error('[StoriesComponent] Compute function error:', error);
            return 'next'; // Default to "next" on error
          }
        },

        /**
         * Apply responsive positioning to an element
         * @param {HTMLElement} element - Element to position
         * @param {Object} positioning - Positioning data
         * @param {Object} containerDims - Container dimensions
         */
        applyResponsivePositioning: (element, positioning, containerDims) => {
          if (!element || !positioning) return;

          const { width, height } = containerDims;

          // Calculate positions based on percentage or pixels
          const calculateValue = (value, dimension) => {
            if (typeof value === 'string' && value.endsWith('%')) {
              return (parseFloat(value) / 100) * dimension;
            }
            return parseFloat(value) || 0;
          };

          // Apply positioning
          if (positioning.position === 'absolute') {
            element.style.position = 'absolute';

            if (positioning.top !== undefined) {
              element.style.top = calculateValue(positioning.top, height) + 'px';
            }
            if (positioning.left !== undefined) {
              element.style.left = calculateValue(positioning.left, width) + 'px';
            }
            if (positioning.right !== undefined) {
              element.style.right = calculateValue(positioning.right, width) + 'px';
            }
            if (positioning.bottom !== undefined) {
              element.style.bottom = calculateValue(positioning.bottom, height) + 'px';
            }
          }

          // Apply dimensions
          if (positioning.width !== undefined) {
            element.style.width = calculateValue(positioning.width, width) + 'px';
          }
          if (positioning.height !== undefined) {
            element.style.height = calculateValue(positioning.height, height) + 'px';
          }

          // Apply other CSS properties
          if (positioning.transform) {
            element.style.transform = positioning.transform;
          }
          if (positioning.zIndex !== undefined) {
            element.style.zIndex = positioning.zIndex;
          }
        },

        /**
         * Parse duration from various formats
         * @param {*} duration - Duration value
         * @returns {number} Duration in seconds
         */
        parseDuration: duration => {
          if (typeof duration === 'number') return duration;
          if (typeof duration === 'string') {
            const parsed = parseFloat(duration);
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        },

        /**
         * Parse position from other.position (absolute px values relative to 412x732)
         * Matches mathai-client getPercentTopLeft implementation (renderer/index.tsx lines 330-377)
         * @param {Object} position - Position object with top/left
         * @param {Object} containerDims - Container dimensions
         * @returns {Object} Parsed position with % or px values
         */
        parsePosition: (position, containerDims) => {
          const DASH_DEVICE_WIDTH = 412;
          const DASH_DEVICE_HEIGHT = 732;
          const { width, height } = containerDims;
          const { top = 0, left = 0 } = position;
          const result = {};

          // Calculate scale factors based on actual container dimensions
          const widthScale = width / DASH_DEVICE_WIDTH;
          const heightScale = height / DASH_DEVICE_HEIGHT;

          // Use the smaller scale to maintain aspect ratio without overflow
          const scale = Math.min(widthScale, heightScale);

          // Calculate scaled dimensions
          const scaledWidth = DASH_DEVICE_WIDTH * scale;
          const scaledHeight = DASH_DEVICE_HEIGHT * scale;

          // Calculate centering offsets
          const horizontalOffset = (width - scaledWidth) / 2;
          const verticalOffset = (height - scaledHeight) / 2;

          // Top in pixels (scaled + centered)
          const scaledTop = (top / DASH_DEVICE_HEIGHT) * scaledHeight;
          result.top = `${scaledTop + verticalOffset}px`;

          // Left in pixels (scaled + centered)
          const scaledLeft = (left / DASH_DEVICE_WIDTH) * scaledWidth;
          result.left = `${scaledLeft + horizontalOffset}px`;

          // Handle right/bottom if provided
          if (position.right !== undefined) {
            const scaledRight = (position.right / DASH_DEVICE_WIDTH) * scaledWidth;
            result.right = `${scaledRight + horizontalOffset}px`;
          }
          if (position.bottom !== undefined) {
            const scaledBottom = (position.bottom / DASH_DEVICE_HEIGHT) * scaledHeight;
            result.bottom = `${scaledBottom + verticalOffset}px`;
          }

          return result;
        },

        /**
         * Parse size from other.size (absolute px values relative to 412x732)
         * Matches mathai-client getPercentHeightWidth implementation (renderer/index.tsx lines 379-409)
         * @param {Object} size - Size object with width/height
         * @param {Object} containerDims - Container dimensions
         * @returns {Object} Parsed size with px values
         */
        parseSize: (size, containerDims) => {
          const DASH_DEVICE_WIDTH = 412;
          const DASH_DEVICE_HEIGHT = 732;
          const { width, height } = containerDims;
          const { height: sizeHeight = 0, width: sizeWidth = 0 } = size;
          const result = {};

          // Calculate scale factors based on actual container dimensions
          const widthScale = width / DASH_DEVICE_WIDTH;
          const heightScale = height / DASH_DEVICE_HEIGHT;

          // Use the smaller scale to maintain aspect ratio without overflow
          const scale = Math.min(widthScale, heightScale);

          // Apply consistent scaling to both width and height
          const newWidth = scale * sizeWidth;
          const newHeight = scale * sizeHeight;

          if (size.width !== undefined) {
            result.width = `${newWidth}px`;
          }
          if (size.height !== undefined) {
            result.height = `${newHeight}px`;
          }

          return result;
        },

        /**
         * Check if text contains dynamic variables (@@variable@@)
         * Matches mathai-client DYNAMIC_TEXT_REGEX pattern
         * @param {string} text - Text to check
         * @returns {boolean} True if text contains @@variables@@
         */
        hasDynamicText: text => {
          if (typeof text !== 'string') return false;
          const DYNAMIC_TEXT_REGEX = /@@(.*?)@@/g;
          return DYNAMIC_TEXT_REGEX.test(text);
        },

        /**
         * Replace dynamic variables (@@variable@@) with values from context
         * Matches mathai-client GlobalVariablesState.getReplacedContent
         * @param {string} text - Text with @@variables@@
         * @param {Object} context - Global context value_map
         * @returns {string} Text with variables replaced
         */
        replaceDynamicText: (text, context) => {
          if (typeof text !== 'string') return text;
          if (!context) return text;

          // Replace @@variable@@ with context.variable
          return text.replace(/@@(.*?)@@/g, (match, variable) => {
            const value = context[variable];
            return value !== undefined ? String(value) : match;
          });
        },

        /**
         * Simple rich text renderer
         * @param {Array} richTextArray - Rich text content array
         * @returns {string} HTML string
         */
        renderRichText: richTextArray => {
          if (!Array.isArray(richTextArray)) return '';

          return richTextArray
            .map(item => {
              if (item.type === 'p') {
                const children = item.children || [];
                const content = children
                  .map(child => {
                    let text = child.text || '';
                    let styles = [];

                    if (child.fontSize) styles.push(`font-size: ${child.fontSize}`);
                    if (child.fontWeight) styles.push(`font-weight: ${child.fontWeight}`);
                    if (child.color) styles.push(`color: ${child.color}`);
                    if (child.lineHeight) styles.push(`line-height: ${child.lineHeight}`);

                    const styleAttr = styles.length ? ` style="${styles.join('; ')}"` : '';

                    if (child.bold) return `<b${styleAttr}>${text}</b>`;
                    if (child.italic) return `<i${styleAttr}>${text}</i>`;
                    if (child.underline) return `<u${styleAttr}>${text}</u>`;
                    return styleAttr ? `<span${styleAttr}>${text}</span>` : text;
                  })
                  .join(' ');

                return `<div>${content}</div>`;
              }
              return '';
            })
            .join('\n');
        },

        /**
         * Replace global variables in content
         * Implements GlobalVariablesState.getReplacedContent logic (GlobalVariable.ts lines 28-101)
         * Replaces @@variableName@@ placeholders with values from globalContext.value_map
         * Reference: /home/rk/Projects/Dev/HomeworkApp/mathai-client/src/modules/home/view/activity/Components/Blocks/AllInOne/GlobalVariable.ts
         * @param {*} content - Content to process (string, object, or array)
         * @param {Object} valueMap - Global context value_map
         * @returns {*} Content with replaced variables
         */
        replaceGlobalVariables: (content, valueMap = {}) => {
          // Deep clone helper
          const deepClone = obj => {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof Array) return obj.map(item => deepClone(item));
            if (obj instanceof Object) {
              const clonedObj = {};
              for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                  clonedObj[key] = deepClone(obj[key]);
                }
              }
              return clonedObj;
            }
            return obj;
          };

          // Remove trailing numbers from keys if there are more than 1 (GlobalVariable.ts lines 64-76)
          const cleanValueMap = {};
          Object.keys(valueMap).forEach(key => {
            // Check for 2 or more trailing numbers like _1_2
            if (/(?:_\d+){2,}$/.test(key)) {
              const cleanKey = key.replace(/(_\d+)+$/, '');
              cleanValueMap[cleanKey] = valueMap[key];
            } else {
              cleanValueMap[key] = valueMap[key];
            }
          });

          // Replace variables in a string (GlobalVariable.ts lines 79-97)
          const replaceInString = str => {
            // Match @@variableName@@
            const regex = /@@(.*?)@@/g;
            const replaced = str.replace(regex, (match, variableName) => {
              const value = cleanValueMap[variableName];
              if (value !== undefined) {
                return typeof value === 'object' ? JSON.stringify(value) : value;
              }
              return match; // Keep original if not found
            });

            // Try to parse as JSON if it looks like JSON
            try {
              const parsed = JSON.parse(replaced);
              return typeof parsed === 'number' ? String(parsed) : parsed;
            } catch {
              return replaced;
            }
          };

          // Recursively replace in nested structures (GlobalVariable.ts lines 33-61)
          const replace = obj => {
            if (Array.isArray(obj)) {
              return obj.map(item => replace(item));
            } else if (typeof obj === 'object' && obj !== null) {
              const result = {};
              Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'string') {
                  result[key] = replaceInString(obj[key]);
                } else {
                  result[key] = replace(obj[key]);
                }
              });
              return result;
            } else if (typeof obj === 'string') {
              return replaceInString(obj);
            }
            return obj;
          };

          return replace(deepClone(content));
        }
      };

      // Renderer functions for different element types
      // All renderers updated to match actual JSON structure from mathai-client
      this.renderers = {
        /**
         * Render a button element
         * Matches StoryButton.tsx implementation (lines 10-131)
         * Structure: elementData.data.button contains {text, color, background_color, font_size, font_weight, action}
         * elementData.other.position/size for positioning (percentage values relative to 412x732)
         */
        renderButton: (elementData, containerDims) => {
          const data = elementData.data || {};
          const other = elementData.other || {};
          const button = data.button || {};

          // Create container for positioning
          const container = document.createElement('div');
          container.className = 'story-button-container';
          container.style.position = 'absolute';
          container.style.zIndex = '3';
          container.style.padding = '12px';

          // Apply position and size from other.position and other.size
          if (other.position) {
            const pos = this.utils.parsePosition(other.position, containerDims);
            Object.assign(container.style, pos);
          }

          if (other.size) {
            const size = this.utils.parseSize(other.size, containerDims);
            Object.assign(container.style, size);
          } else {
            container.style.width = '100%';
          }

          // Create button element
          const element = document.createElement('button');
          element.className = 'story-button';
          element.setAttribute('data-element-type', 'button');

          if (elementData.id) element.setAttribute('data-element-id', elementData.id);
          if (data.name) {
            element.setAttribute('data-element-name', data.name);
            element.setAttribute('data-button-name', data.name);
          }
          if (button.action) {
            element.setAttribute('data-button-action', JSON.stringify({ ...button, ...button.action }));
          }

          element.textContent = button.text || '';

          // Apply button styles from data.button (matches StoryButton.tsx line 70)
          element.style.width = '100%';
          element.style.height = !other.size ? '58px' : '100%';
          element.style.color = button.color || '#000';
          element.style.background = button.background_color || '#fff';
          element.style.fontSize = button.font_size ? `${button.font_size / 16}rem` : '1rem';
          element.style.fontWeight = button.font_weight || '400';
          element.style.fontFamily = 'Epilogue, sans-serif';
          element.style.borderRadius = '8px';
          element.style.border = 'none';
          element.style.display = 'flex';
          element.style.justifyContent = 'center';
          element.style.alignItems = 'center';
          element.style.boxShadow = '2px 2px 16px rgba(0, 0, 0, 0.16)';
          element.style.userSelect = 'none';
          element.style.cursor = 'pointer';

          container.appendChild(element);
          return container;
        },

        /**
         * Render an avatar (video player) element
         * Matches StoryAvatar.tsx implementation (lines 68-377)
         * Structure: elementData.data.v2_avatar contains {type, value, heygen}
         * elementData.other.position/size for positioning
         */
        renderV2_avatar: (elementData, containerDims) => {
          const data = elementData.data || {};
          const other = elementData.other || {};
          const avatar = data.v2_avatar || {};

          const container = document.createElement('div');
          container.className = 'story-avatar-container';
          container.style.position = 'absolute';
          container.style.borderRadius = '100%';
          container.style.overflow = 'hidden';
          container.style.zIndex = '4';

          // Apply position and size
          if (other.position) {
            const pos = this.utils.parsePosition(other.position, containerDims);
            Object.assign(container.style, pos);
          }

          if (other.size) {
            const size = this.utils.parseSize(other.size, containerDims);
            Object.assign(container.style, size);
          } else {
            container.style.width = '72px';
            container.style.height = '72px';
          }

          // Render based on avatar type
          if (avatar.type === 'image') {
            const img = document.createElement('img');
            img.src = avatar.value || '';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.borderRadius = '100%';
            // img.style.objectFit = 'cover';
            img.setAttribute('data-element-type', 'v2_avatar');
            if (elementData.id) img.setAttribute('data-element-id', elementData.id);
            if (data.name) img.setAttribute('data-element-name', data.name);
            container.appendChild(img);
          } else if (avatar.type === 'video' || avatar.type === 'heygen_avatar') {
            const video = document.createElement('video');
            video.src = avatar.type === 'video' ? avatar.value : avatar.heygen?.video || '';
            video.autoplay = true;
            video.loop = false;
            video.muted = false;
            video.playsInline = true;
            video.controls = false;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.borderRadius = '100%';
            // video.style.objectFit = 'cover';
            if (avatar.type === 'heygen_avatar') {
              video.style.objectPosition = '10% 25%';
            }
            video.setAttribute('data-element-type', 'v2_avatar');
            if (elementData.id) video.setAttribute('data-element-id', elementData.id);
            if (data.name) video.setAttribute('data-element-name', data.name);
            container.appendChild(video);

            // Track avatar video load errors
            const videoSrc = avatar.type === 'video' ? avatar.value : avatar.heygen?.video || '';
            video.addEventListener('error', e => {
              console.error('[StoriesComponent] Avatar video load error:', videoSrc);
              this.handleMediaLoadError('video', videoSrc, e);
            });

            // Explicitly play avatar video after appending to DOM
            setTimeout(() => {
              video.play().catch(error => {
                console.warn('[StoriesComponent] Avatar video autoplay blocked:', error);

                // Check if it's a permission error - show popup instead of muting
                if (error.name === 'NotAllowedError') {
                  this.handleMediaPermissionError('video');
                  return; // Don't try muted fallback
                }

                // If autoplay fails (but not permission error), try muting and replaying
                if (!video.muted) {
                  console.log('[StoriesComponent] Retrying avatar video playback with muted audio');
                  video.muted = true;
                  video.play().catch(err => {
                    console.error('[StoriesComponent] Avatar video playback failed even when muted:', err);

                    // Check again for permission error
                    if (err.name === 'NotAllowedError') {
                      this.handleMediaPermissionError('video');
                    }
                  });
                }
              });
            }, 100);
          }

          return container;
        },

        /**
         * Render an image element
         * Matches StoryImage.tsx implementation (lines 5-42)
         * Structure: elementData.data.image contains image URL
         * elementData.other.position/size/angle for positioning and rotation
         */
        renderImage: (elementData, containerDims) => {
          const data = elementData.data || {};
          const other = elementData.other || {};

          const container = document.createElement('div');
          container.className = 'story-image-container';
          container.style.position = 'absolute';
          container.style.zIndex = '2';

          // Apply position and size
          if (other.position) {
            const pos = this.utils.parsePosition(other.position, containerDims);
            Object.assign(container.style, pos);
          }

          if (other.size) {
            const size = this.utils.parseSize(other.size, containerDims);
            Object.assign(container.style, size);
          }

          // Apply rotation if angle is specified
          if (other.angle !== undefined) {
            container.style.transform = `rotate(${other.angle}deg)`;
          }

          const img = document.createElement('img');
          img.src = data.image || '';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.pointerEvents = 'none';
          img.style.userSelect = 'none';
          img.setAttribute('data-element-type', 'image');

          if (elementData.id) img.setAttribute('data-element-id', elementData.id);
          if (data.name) img.setAttribute('data-element-name', data.name);

          container.appendChild(img);
          return container;
        },

        /**
         * Render an input element
         * Matches StoryInput.tsx implementation (lines 11-108)
         * Structure: elementData.data.input contains {placeholder, inputType, isTextarea, default_value}
         * elementData.data.linked_global_context_variable for global context linking
         * elementData.other.position/size for positioning
         */
        renderInput: (elementData, containerDims) => {
          const data = elementData.data || {};
          const other = elementData.other || {};
          const input = data.input || {};

          const element = document.createElement(input.isTextarea ? 'textarea' : 'input');
          element.className = 'story-input';
          element.setAttribute('data-element-type', 'input');
          element.style.position = 'absolute';
          element.style.zIndex = '4';

          if (elementData.id) element.setAttribute('data-element-id', elementData.id);
          if (data.name) {
            element.setAttribute('data-element-name', data.name);
            element.setAttribute('data-input-name', data.name);
          }

          // Link to global context if specified
          if (data.linked_global_context_variable?.name) {
            element.setAttribute('data-global-context-var', data.linked_global_context_variable.name);
          }

          if (!input.isTextarea) {
            element.type = input.inputType || 'text';
          }
          element.placeholder = input.placeholder || '';
          element.value = data.value || input.default_value || '';

          // Apply position and size
          if (other.position) {
            const pos = this.utils.parsePosition(other.position, containerDims);
            Object.assign(element.style, pos);
          }

          if (other.size) {
            const size = this.utils.parseSize(other.size, containerDims);
            Object.assign(element.style, size);
            element.style.maxWidth = size.width;
            element.style.maxHeight = size.height;
          }

          // Apply input styles
          element.style.borderRadius = '2px';
          element.style.background = '#F9F8F8';
          element.style.border = '0.5px solid #4F4F4F';
          element.style.color = '#000';
          element.style.fontSize = '1rem';
          element.style.fontWeight = '400';
          element.style.padding = '16px 8px';
          element.style.fontFamily = 'inherit';

          return element;
        },

        /**
         * Render a rich text element
         * Matches StoryRichText.tsx implementation (lines 9-56)
         * Structure: elementData.data.v2_rich_text contains rich text content array
         * elementData.data.textAlign for text alignment
         * elementData.other.position/size for positioning
         */
        renderV2_rich_text: (elementData, containerDims) => {
          const data = elementData.data || {};
          const other = elementData.other || {};

          const element = document.createElement('div');
          element.className = 'story-rich-text';
          element.setAttribute('data-element-type', 'v2_rich_text');
          element.style.position = 'absolute';
          element.style.zIndex = '10';
          element.style.padding = '20px';
          element.style.pointerEvents = 'none';
          element.style.userSelect = 'none';

          if (elementData.id) element.setAttribute('data-element-id', elementData.id);
          if (data.name) element.setAttribute('data-element-name', data.name);

          // Apply position and size
          if (other.position) {
            const pos = this.utils.parsePosition(other.position, containerDims);
            Object.assign(element.style, pos);
          }

          if (other.size) {
            const size = this.utils.parseSize(other.size, containerDims);
            Object.assign(element.style, size);
          }

          // Apply text alignment
          element.style.textAlign = data.textAlign || 'left';

          // Render rich text content
          if (data.v2_rich_text) {
            element.innerHTML = this.utils.renderRichText(data.v2_rich_text);
          }

          return element;
        }
      };
    }

    /**
     * Fetch story block data from GraphQL
     * @param {number|string} storyBlockId - Story block ID
     * @returns {Promise<Object>} Story block data
     */
    async fetchStoryBlock(storyBlockId) {
      const GRAPHQL_ENDPOINT = this.config.graphqlEndpoint || 'https://qa.graphql.sets.hmwrk.app/v1/graphql';
      const HASURA_SECRET = 'ultimate';

      const query = `
        query GetStoryBlock($id: Int!) {
          blocks: worksheet_block_by_pk(id: $id) {
            id
            backend
            data
            type
            __typename
            parent_id
          }
        }
      `;

      try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_SECRET
          },
          body: JSON.stringify({
            query: query,
            variables: {
              id: parseInt(storyBlockId)
            }
          })
        });

        if (!response.ok) {
          throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        }

        if (!result.data?.blocks) {
          throw new Error(`Story block with id ${storyBlockId} not found`);
        }

        return result.data.blocks;
      } catch (error) {
        console.error('[StoriesComponent] Failed to fetch story block:', error);
        throw error;
      }
    }

    /**
     * Track story analytics event
     * @param {string} eventName - Event name
     * @param {Object} additionalProps - Additional event properties
     */
    _trackStoryEvent(eventName, additionalProps = {}) {
      if (!this.analyticsEnabled || !this.analytics) return;

      try {
        const currentStory = this.stories[this.currentStoryIndex];
        const prevStory = this.currentStoryIndex > 0 ? this.stories[this.currentStoryIndex - 1] : null;

        const baseProps = {
          story_type: 'story_block',
          name_of_the_story: currentStory?.name || '',
          id_of_the_level: currentStory?.id || currentStory?.tmpId || '',
          story_number: this.currentStoryIndex + 1,
          prev_story_name: prevStory?.name || '',
          ...(this.config.analyticsContext || {})
        };

        this.analytics.track(eventName, { ...baseProps, ...additionalProps });
      } catch (error) {
        console.warn('[StoriesComponent] Analytics tracking error:', error);
      }
    }

    /**
     * Initialize the component
     * Matches StoriesBlock.tsx useEffect initialization (lines 367-394)
     */
    async init() {
      try {
        // Fetch story block from GraphQL
        console.log('[StoriesComponent] Fetching story block:', this.config.storyBlockId);
        const storyBlockData = await this.fetchStoryBlock(this.config.storyBlockId);
        console.log('[StoriesComponent] Story block fetched:', storyBlockData);

        // Parse story block
        this.parseStoryBlock(storyBlockData);

        // Validate stories
        if (this.stories.length === 0) {
          throw new Error('No stories found in story block');
        }

        // Initialize state tracking
        this.isLoading = true;
        this.storyDurationRef = {}; // Reset duration tracking
        this.assetDurations = {}; // Reset asset cache
        this.durationData.currentStoryInactiveDuration = 0;
        this.durationData.totalStoryInactiveTabDuration = 0;

        // Initialize duration tracking
        if (this.config.trackDuration) {
          this.durationData.startTime = Date.now();
        }

        // Setup tab visibility handling
        if (this.config.pauseOnTabSwitch) {
          this.setupVisibilityHandling();
        }

        // Setup online/offline event listeners for auto-recovery
        this.setupOnlineOfflineListeners();

        // Setup resize handling for responsive positioning
        this.setupResizeHandling();

        // Initialize audio manager
        if (this.config.enableAudio && window.FeedbackManager) {
          this.audioManager = window.FeedbackManager.sound;
        }

        // Render initial container structure
        this.render();

        // Update container dimensions (after render so dimensions are correct)
        this.updateContainerDimensions();

        // Setup navigation click areas (only once)
        this.setupNavigationAreas();

        // Calculate first story duration (StoriesBlock lines 380-382)
        const firstStoryDuration = await this.getAssetsDuration(this.stories[0]);
        console.log('[StoriesComponent] First story duration:', firstStoryDuration);

        // Set current index to 0 (StoriesBlock line 385)
        this.currentStoryIndex = 0;

        // Preload asset durations for all stories (StoriesBlock line 387)
        if (this.config.preloadAssets) {
          await this.setStoryAssetsDuration(this.stories);
        }

        // Show first story (after brief delay for smooth initialization)
        setTimeout(() => {
          this.isLoading = false;
          this.showStory(0, 'initial');
        }, 50);
      } catch (error) {
        this.handleError(error);
      }
    }

    /**
     * Parse story block JSON and extract stories
     * Matches StoriesBlock.tsx implementation parsing from data.children array
     * @param {Object} storyBlockData - Story block JSON with structure { data: { children: [] } }
     */
    parseStoryBlock(storyBlockData) {
      try {
        // Extract data from story block (no v2_stories wrapper, direct children access)
        const data = storyBlockData.data || storyBlockData;

        if (!data.children || !Array.isArray(data.children)) {
          throw new Error('Story block must have data.children array');
        }

        // Parse each story from children array
        this.stories = data.children.map((child, index) => {
          const childData = child.data || {};

          // Extract v2_story format from child.data.v2_story
          const v2Story = childData.v2_story || {};
          const storyChildren = childData.children || [];
          const otherData = childData.other || {};

          // Extract background configuration (StoriesBlock format)
          const background = v2Story.background || {};

          // Extract logic and compute functions
          const logic = v2Story.logic || {};
          const computeFunctions = logic.compute_functions || [];

          // Find getNextStory function from compute_functions array
          const getNextStoryFunc = computeFunctions.find(
            func => func.name === 'getNextStory' || func.type === 'getNextStory'
          );

          // Extract background audio URL from other.audio structure
          let backgroundAudioUrl = null;
          if (otherData.audio) {
            if (typeof otherData.audio === 'string') {
              // Direct URL string
              backgroundAudioUrl = otherData.audio;
            } else if (otherData.audio.audio_url) {
              // Simple object with audio_url
              backgroundAudioUrl = otherData.audio.audio_url;
            } else if (otherData.audio.audio_texts && Array.isArray(otherData.audio.audio_texts)) {
              // Complex structure with audio_texts array
              const firstAudioText = otherData.audio.audio_texts[0];
              if (firstAudioText && firstAudioText.audio_urls && Array.isArray(firstAudioText.audio_urls)) {
                // Find the first active audio URL
                const activeAudio = firstAudioText.audio_urls.find(a => a.is_active);
                if (activeAudio && activeAudio.url) {
                  backgroundAudioUrl = activeAudio.url;
                } else if (firstAudioText.audio_urls[0] && firstAudioText.audio_urls[0].url) {
                  // Fallback to first URL if no active one found
                  backgroundAudioUrl = firstAudioText.audio_urls[0].url;
                }
              }
            }
          }

          // Extract audio generation configuration (for TTS with dynamic text)
          let audioTexts = null;
          let audioLanguage = null;
          let audioArtist = null;
          let generatedForText = null;

          if (otherData.audio && typeof otherData.audio === 'object') {
            // audio_texts contains the text template for TTS generation
            if (otherData.audio.audio_texts && Array.isArray(otherData.audio.audio_texts)) {
              const firstAudioText = otherData.audio.audio_texts[0];
              if (firstAudioText) {
                audioTexts = firstAudioText.text || null;
                audioLanguage = firstAudioText.language || 'Hindi';
                audioArtist = firstAudioText.artist || null;
              }
            }
            // generated_for_text is the cache key (text with variables replaced)
            generatedForText = otherData.audio.generated_for_text || null;
          }

          // Build story object matching StoriesBlock structure
          const story = {
            index: index,
            name: v2Story.name || `story_slide_${index}`,
            id: v2Story.id || child.id,

            // Background configuration (new structure)
            background: {
              type: background.type || 'COLOR', // 'COLOR', 'IMAGE', 'VIDEO'
              value: background.value || '', // URL or color value
              temp_value: background.temp_value || null, // Temporary value
              loop: background.loop !== false, // Default true
              default: background.default || null // Default value
            },

            // Compute functions (from logic.compute_functions array)
            compute_functions: computeFunctions,

            // Duration configuration
            duration_type: v2Story.duration_type || 'manual', // 'manual', 'duration', 'maximum', 'bg_video', 'bg_audio', 'avatar'
            is_skip: v2Story.is_skip !== false, // Whether story can be skipped

            // Audio configuration (new structure)
            bg_audio_list: v2Story.bg_audio_list || [], // Array of background audio
            play_multiple_audio: v2Story.play_multiple_audio === true, // Play multiple audio simultaneously
            backgroundAudio: backgroundAudioUrl, // Extracted background audio URL for playback

            // Audio generation configuration (TTS for dynamic text with @@variables@@)
            audioTexts: audioTexts, // Text template with @@variables@@
            audioLanguage: audioLanguage, // Language for TTS (e.g., 'Hindi')
            audioArtist: audioArtist, // Voice/artist configuration
            generatedForText: generatedForText, // Cache key (text with variables replaced)

            // Story elements (from children)
            elements: storyChildren,

            // Compute function for navigation (extracted from compute_functions)
            getNextStory: getNextStoryFunc
              ? getNextStoryFunc.code || getNextStoryFunc.value || getNextStoryFunc.output
              : null,

            // Other metadata
            other: otherData,

            // Raw data for reference
            raw: child
          };

          // Map story name to index for lookup
          if (story.name) {
            this.storiesMap[story.name] = index;
          }

          return story;
        });

        // Extract audio generation map (gen_audio_map) from story block data
        // Format: Array indexed by story, each entry contains stories to generate at that index
        if (data.gen_audio_map && Array.isArray(data.gen_audio_map)) {
          this.genAudioMap = data.gen_audio_map;
          console.log('[StoriesComponent] Audio generation map extracted:', this.genAudioMap);
        }

        console.log(`[StoriesComponent] Parsed ${this.stories.length} stories from data.children`);
      } catch (error) {
        console.error('[StoriesComponent] Story parsing error:', error);
        throw error;
      }
    }

    /**
     * Setup tab visibility change handling
     */
    setupVisibilityHandling() {
      // Use VisibilityTracker component if available
      if (window.VisibilityTracker) {
        this.visibilityTracker = new window.VisibilityTracker({
          onInactive: () => {
            this.handleTabHidden();
          },
          onResume: () => {
            this.handleTabVisible();
          },
          autoShowPopup: true, // Show popup when user goes inactive
          enabled: true
        });
      } else {
        // Fallback to manual visibility handling if VisibilityTracker not available
        this.visibilityHandler = () => {
          if (document.hidden) {
            this.handleTabHidden();
          } else {
            this.handleTabVisible();
          }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
      }
    }

    /**
     * Setup online/offline event listeners for auto-recovery
     * Matches mathai-client's auto-refresh on network recovery pattern
     */
    setupOnlineOfflineListeners() {
      // Listen for online event - auto-retry when network comes back
      this.onlineHandler = () => {
        console.log('[StoriesComponent] Network back online');

        // If we had a content or network error, auto-retry
        if (this.isContentError || this.isNetworkOffline) {
          console.log('[StoriesComponent] Auto-retrying after network recovery');
          this.retryLoadMedia();
        }
      };

      // Listen for offline event - update state
      this.offlineHandler = () => {
        console.log('[StoriesComponent] Network went offline');
        this.isNetworkOffline = true;
      };

      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }

    /**
     * Handle tab hidden event
     */
    handleTabHidden() {
      this.isPaused = true;
      this.durationData.tabHiddenTime = Date.now();

      // Pause all media (video and audio)
      this.pauseAllMedia();

      // Update UI state
      this.updatePauseState(true);
    }

    /**
     * Handle tab visible event
     */
    handleTabVisible() {
      // Calculate inactive duration
      if (this.durationData.tabHiddenTime) {
        const inactiveDuration = (Date.now() - this.durationData.tabHiddenTime) / 1000;
        this.durationData.currentStoryInactiveDuration += inactiveDuration;
        this.durationData.inactive += inactiveDuration;
        this.durationData.tabHiddenTime = null;
      }

      this.isPaused = false;

      // Resume all media (video and audio)
      this.resumeAllMedia();

      // Update UI state
      this.updatePauseState(false);
    }

    /**
     * Update pause state in UI
     * @param {boolean} paused - Whether component is paused
     */
    updatePauseState(paused) {
      const storyContent = this.container.querySelector('.story-content');
      if (storyContent) {
        storyContent.style.opacity = paused ? '0.7' : '1';
        storyContent.style.pointerEvents = paused ? 'none' : 'auto';
      }
    }

    /**
     * Setup resize handling for responsive positioning
     */
    setupResizeHandling() {
      // Debounce resize events to avoid excessive re-renders
      let resizeTimeout;

      this.resizeHandler = () => {
        clearTimeout(resizeTimeout);

        resizeTimeout = setTimeout(() => {
          // Fix Safari mobile viewport height issue
          this.fixSafariViewportHeight();

          this.updateContainerDimensions();

          // Only update element positions, don't re-render entire story
          if (!this.isLoading && this.currentIndex >= 0) {
            this.repositionStoryElements();
          }
        }, 150); // Debounce for 150ms
      };

      window.addEventListener('resize', this.resizeHandler);

      // Also listen for orientation changes on mobile devices
      window.addEventListener('orientationchange', this.resizeHandler);

      // Fix Safari viewport height on initial load
      this.fixSafariViewportHeight();
    }

    /**
     * Fix Safari mobile viewport height issue
     * Safari's 100vh includes the URL bar, causing content to be hidden
     * This sets the actual viewport height dynamically
     */
    fixSafariViewportHeight() {
      // Use window.innerHeight for the actual visible viewport height
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);

      // Also set container height directly for browsers without dvh support
      if (this.container) {
        // Check if dvh is supported
        const supportsDvh = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('height', '100dvh');

        if (!supportsDvh) {
          // For browsers without dvh support (Safari < 15.4, older Android browsers)
          // Use window.innerHeight which gives the actual visible viewport
          this.container.style.height = `${window.innerHeight}px`;
        }
        // If dvh is supported, don't override - let the CSS handle it
      }
    }

    /**
     * Update container dimensions
     */
    updateContainerDimensions() {
      const rect = this.container.getBoundingClientRect();
      this.containerDimensions = {
        width: rect.width || this.container.offsetWidth,
        height: rect.height || this.container.offsetHeight
      };
    }

    /**
     * Reposition story elements without re-rendering
     * Updates element positions based on new container dimensions
     */
    repositionStoryElements() {
      const storyContent = this.container.querySelector('.story-content');
      if (!storyContent) return;

      // Find all positioned elements and update their positions
      const positionedElements = storyContent.querySelectorAll('[data-element-type]');

      positionedElements.forEach(element => {
        const elementId = element.getAttribute('data-element-id');
        const elementName = element.getAttribute('data-element-name');

        // Find the original element data from current story
        if (this.currentIndex >= 0 && this.currentIndex < this.stories.length) {
          const story = this.stories[this.currentIndex];

          if (story.elements) {
            const elementData = story.elements.find(el => el.id === elementId || el.data?.name === elementName);

            if (elementData && elementData.position) {
              // Recalculate and apply responsive positioning
              this.utils.applyResponsivePositioning(element, elementData.position, this.containerDimensions);
            }
          }
        }
      });

      console.log('[StoriesComponent] Repositioned story elements for new dimensions');
    }

    /**
     * Preload asset durations for all stories
     */
    async preloadAssetDurations() {
      const assets = [];

      // Collect all unique assets
      this.stories.forEach(story => {
        if (story.backgroundVideo) {
          assets.push({ type: 'video', url: story.backgroundVideo });
        }
        if (story.backgroundAudio) {
          assets.push({ type: 'audio', url: story.backgroundAudio });
        }
        if (story.audio) {
          assets.push({ type: 'audio', url: story.audio });
        }

        // Check elements for video/audio
        if (story.elements && Array.isArray(story.elements)) {
          story.elements.forEach(element => {
            const elemData = element.data || {};
            if (elemData.type === 'video' && elemData.src) {
              assets.push({ type: 'video', url: elemData.src });
            }
            if (elemData.type === 'audio' && elemData.src) {
              assets.push({ type: 'audio', url: elemData.src });
            }
          });
        }
      });

      // Preload unique assets
      const uniqueAssets = Array.from(new Map(assets.map(a => [a.url, a])).values());

      const promises = uniqueAssets.map(({ url, type }) => {
        if (this.assetDurations[url]) return Promise.resolve();

        return new Promise(resolve => {
          const mediaElement = document.createElement(type === 'video' ? 'video' : 'audio');

          mediaElement.addEventListener('loadedmetadata', () => {
            this.assetDurations[url] = mediaElement.duration;
            resolve();
          });

          mediaElement.addEventListener('error', e => {
            console.warn(`[StoriesComponent] Failed to load asset: ${url}`);
            this.handleMediaLoadError(type, url, e);
            resolve(); // Continue even if asset fails
          });

          mediaElement.src = url;
        });
      });

      await Promise.all(promises);
      console.log(`[StoriesComponent] Preloaded ${uniqueAssets.length} asset durations`);
    }

    /**
     * Get assets duration for a story
     * Matches StoriesBlock.tsx getAssetsDuration (lines 185-251)
     * @param {Object} story - Story object from this.stories array
     * @returns {Promise<number>} Duration in seconds
     */
    async getAssetsDuration(story) {
      try {
        const { other, duration_type, background, elements } = story;

        // If duration_type is 'duration', use explicit duration from other.duration
        if (duration_type === 'duration') {
          return other?.duration || 0;
        }

        const mediaAssets = [];

        // Collect background video assets
        if (
          (!duration_type || ['maximum', 'bg_video'].includes(duration_type)) &&
          background?.type === 'VIDEO' &&
          background?.value
        ) {
          mediaAssets.push({
            type: 'VIDEO',
            url: background.value
          });
        }

        // Collect background audio assets
        const backgroundAudio = other?.audio && typeof other.audio === 'object' ? other.audio.audio_url : other?.audio;

        if ((!duration_type || ['maximum', 'bg_audio'].includes(duration_type)) && backgroundAudio) {
          mediaAssets.push({
            type: 'AUDIO',
            url: backgroundAudio,
            duration: other?.audio?.other?.duration
          });
        }

        // Collect avatar video assets
        if (!duration_type || ['maximum', 'avatar'].includes(duration_type)) {
          if (elements && Array.isArray(elements)) {
            elements.forEach(element => {
              const elemData = element.data || {};
              if (element.type === 'v2_avatar' && ['video', 'heygen_avatar'].includes(elemData.v2_avatar?.type)) {
                const avatarType = elemData.v2_avatar?.type;
                const videoUrl = avatarType === 'video' ? elemData.v2_avatar?.value : elemData.v2_avatar?.heygen?.video;

                if (videoUrl) {
                  mediaAssets.push({
                    type: 'VIDEO',
                    url: videoUrl
                  });
                }
              }
            });
          }
        }

        // Get maximum duration from all assets
        const duration = await this.getMaxDuration(mediaAssets, other?.duration);
        return duration;
      } catch (error) {
        console.error('[StoriesComponent] Error calculating assets duration:', error);
        return 0;
      }
    }

    /**
     * Get maximum duration from media assets
     * Helper for getAssetsDuration
     * @param {Array} mediaAssets - Array of media assets with {type, url, duration?}
     * @param {number} fallbackDuration - Fallback duration if no assets
     * @returns {Promise<number>} Maximum duration in seconds
     */
    async getMaxDuration(mediaAssets, fallbackDuration = 0) {
      if (!mediaAssets || mediaAssets.length === 0) {
        return fallbackDuration || 0;
      }

      const durations = await Promise.all(
        mediaAssets.map(async asset => {
          // If explicit duration is provided, use it
          if (asset.duration) {
            return asset.duration;
          }

          // Check if already cached
          if (this.assetDurations[asset.url]) {
            return this.assetDurations[asset.url];
          }

          // Load and get duration
          return new Promise(resolve => {
            const mediaElement = document.createElement(asset.type === 'VIDEO' ? 'video' : 'audio');

            mediaElement.addEventListener('loadedmetadata', () => {
              const duration = mediaElement.duration || 0;
              this.assetDurations[asset.url] = duration;
              resolve(duration);
            });

            mediaElement.addEventListener('error', () => {
              console.warn(`[StoriesComponent] Failed to load asset: ${asset.url}`);
              resolve(0);
            });

            mediaElement.src = asset.url;
          });
        })
      );

      // Return maximum duration
      const maxDuration = Math.max(...durations, 0);
      return maxDuration || fallbackDuration || 0;
    }

    /**
     * Preload and cache asset durations for all stories
     * Matches StoriesBlock.tsx setStoryAssetsDuration pattern
     * @param {Array} stories - Array of story objects
     */
    async setStoryAssetsDuration(stories) {
      try {
        console.log('[StoriesComponent] Preloading asset durations for', stories.length, 'stories');

        // Process each story to load its asset durations
        const promises = stories.map(async story => {
          try {
            const duration = await this.getAssetsDuration(story);
            // Cache the duration for this story
            if (story.index !== undefined) {
              this.assetDurations[`story_${story.index}`] = duration;
            }
            return duration;
          } catch (error) {
            console.warn(`[StoriesComponent] Error loading assets for story ${story.index}:`, error);
            return 0;
          }
        });

        await Promise.all(promises);
        console.log('[StoriesComponent] Completed preloading asset durations');
      } catch (error) {
        console.error('[StoriesComponent] Error in setStoryAssetsDuration:', error);
      }
    }

    /**
     * Get story duration based on duration_type
     * @param {Object} story - Story object
     * @returns {number} Duration in seconds
     */
    getStoryDuration(story) {
      // If explicit duration is set, use it
      if (story.duration !== undefined && story.duration !== null) {
        return this.utils.parseDuration(story.duration);
      }

      const durationType = story.duration_type || 'manual';
      const durations = [];

      switch (durationType) {
        case 'video':
          // Use background video duration
          if (story.backgroundVideo && this.assetDurations[story.backgroundVideo]) {
            durations.push(this.assetDurations[story.backgroundVideo]);
          }
          break;

        case 'audio':
          // Use background audio or story audio duration
          if (story.backgroundAudio && this.assetDurations[story.backgroundAudio]) {
            durations.push(this.assetDurations[story.backgroundAudio]);
          }
          if (story.audio && this.assetDurations[story.audio]) {
            durations.push(this.assetDurations[story.audio]);
          }
          break;

        case 'max':
          // Use maximum of all asset durations
          if (story.backgroundVideo && this.assetDurations[story.backgroundVideo]) {
            durations.push(this.assetDurations[story.backgroundVideo]);
          }
          if (story.backgroundAudio && this.assetDurations[story.backgroundAudio]) {
            durations.push(this.assetDurations[story.backgroundAudio]);
          }
          if (story.audio && this.assetDurations[story.audio]) {
            durations.push(this.assetDurations[story.audio]);
          }
          break;

        case 'manual':
        default:
          // Manual control - no auto duration
          return 0;
      }

      return durations.length > 0 ? Math.max(...durations) : 0;
    }

    /**
     * Render main container structure
     * Container takes full viewport (100vw x 100vh) when stories are active
     */
    render() {
      // Make container fullscreen with max width constraint
      this.container.style.position = 'fixed';
      this.container.style.top = '0';
      this.container.style.left = '50%';
      this.container.style.transform = 'translateX(-50%)';
      this.container.style.width = '100vw';
      this.container.style.maxWidth = '480px';

      // Handle viewport height with fallbacks for Safari mobile and older browsers
      // 1. Try dvh (dynamic viewport height) for modern browsers
      // 2. Fall back to window.innerHeight for older browsers that don't support dvh
      this.container.style.height = '100vh';
      if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('height', '100dvh')) {
        this.container.style.height = '100dvh';
      } else {
        // For browsers without dvh support, use actual viewport height
        this.container.style.height = `${window.innerHeight}px`;
      }

      this.container.style.zIndex = '9999';
      this.container.style.overflow = 'hidden';

      this.container.innerHTML = `
        <!-- Global audio element for story narration (matches mathai-client pattern) -->
        <audio id="commonSoundComponent" preload="auto" style="display: none;"></audio>

        <div class="stories-wrapper" style="
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
          background: #ffffff;
        ">
          ${this.config.showProgress
          ? `
            <div class="stories-progress" style="
              position: absolute;
              top: 16px;
              left: 16px;
              right: 16px;
              z-index: 100;
            "></div>
          `
          : ''
        }

          <div class="story-content" style="
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
          "></div>

          <div class="story-nav-left" style="
            position: absolute;
            left: 0;
            top: 20vh;
            width: 120px;
            height: 60vh;
            z-index: 50;
            cursor: pointer;
            background: transparent;
          "></div>

          <div class="story-nav-right" style="
            position: absolute;
            right: 0;
            top: 20vh;
            width: 120px;
            height: 60vh;
            z-index: 50;
            cursor: pointer;
            background: transparent;
          "></div>

          <div class="stories-loader" style="
            display: none;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #f5f5f5;
            align-items: center;
            justify-content: center;
            z-index: 200;
          ">
            <div style="
              width: 90%;
              max-width: 400px;
              aspect-ratio: 9/16;
              background-color: #e0e0e0;
              border-radius: 12px;
              animation: pulse 1.5s ease-in-out infinite;
            "></div>
            <style>
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            </style>
          </div>
        </div>
      `;
    }

    /**
     * Update progress bar
     */
    updateProgress(percentage = 0) {
      if (!this.config.showProgress) return;

      const progressContainer = this.container.querySelector('.stories-progress');
      if (!progressContainer) return;

      const total = this.stories.length;
      const currentStory = this.currentIndex + 1;

      // Generate individual progress bars for each story
      const progressBars = this.stories
        .map((story, i) => {
          const isSkip = story.is_skip ?? true;
          const isCompleted = currentStory > i + 1;
          const isCurrent = currentStory === i + 1;

          // If is_skip is false, show completely filled bar for current story
          const progressWidth = !isSkip && isCurrent ? 100 : isCurrent ? percentage : 0;

          // Background: filled for completed stories or current non-skippable, gray otherwise
          const background = isCompleted || (!isSkip && isCurrent) ? '#FFDE48' : 'rgba(217, 217, 217, 0.6)';

          return `
          <div style="
            width: 100%;
            height: 4px;
            border-radius: 2px;
            background: ${background};
            flex-shrink: 1;
            position: relative;
          ">
            ${isCurrent && isSkip
              ? `
              <div style="
                width: ${progressWidth}%;
                height: 4px;
                border-radius: 2px;
                background: #FFDE48;
                transition: width 0.1s linear;
              "></div>
            `
              : ''
            }
          </div>
        `;
        })
        .join('');

      progressContainer.innerHTML = `
        <div style="
          display: flex;
          gap: 8px;
          width: 100%;
        ">
          ${progressBars}
        </div>
      `;
    }

    /**
     * Start progress tracking for current story
     * Tracks media playback or manual duration progress
     */
    startProgressTracking(story) {
      // Clear any existing progress interval
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }

      // If is_skip is false, show 100% immediately and don't track
      if (story.is_skip === false) {
        this.updateProgress(100);
        return;
      }

      // For stories with background video, progress is tracked via timeupdate event
      // For other stories (image, audio, manual duration), use interval-based tracking
      const hasBackgroundVideo = story.background?.type === 'VIDEO' && story.background?.value;

      if (!hasBackgroundVideo) {
        // Get story duration (in seconds)
        const duration = this.getStoryDuration(story);

        if (duration > 0) {
          const startTime = Date.now();
          const updateInterval = 100; // Update every 100ms for smooth progress

          this.progressInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000; // seconds
            const percentage = Math.min((elapsed / duration) * 100, 100);

            this.updateProgress(percentage);

            // Stop tracking when complete
            if (percentage >= 100) {
              clearInterval(this.progressInterval);
              this.progressInterval = null;
            }
          }, updateInterval);
        }
      }
    }

    /**
     * Show loading state
     */
    showLoading() {
      this.isLoading = true;
      const loader = this.container.querySelector('.stories-loader');
      if (loader) {
        loader.style.display = 'flex';
      }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
      this.isLoading = false;
      const loader = this.container.querySelector('.stories-loader');
      if (loader) {
        loader.style.display = 'none';
      }
    }

    /**
     * Show a specific story
     * @param {number} index - Story index
     * @param {string} direction - Navigation direction ('next', 'prev', 'jump', 'initial', 'resize')
     */
    async showStory(index, direction = 'next') {
      try {
        // Validate index
        if (index < 0 || index >= this.stories.length) {
          console.warn(`[StoriesComponent] Invalid story index: ${index}`);
          return;
        }

        // Get the story we're about to show
        const currentStory = this.stories[index];

        // Check if this story needs audio generation RIGHT NOW (on-demand)
        // Only generate if:
        // 1. Story has audioTexts (template with @@variables@@)
        // 2. Text contains dynamic variables
        // 3. No audio URL exists yet OR cache key doesn't match (variables changed)
        if (currentStory.audioTexts && this.utils.hasDynamicText(currentStory.audioTexts)) {
          const replacedText = this.utils.replaceDynamicText(currentStory.audioTexts, this.globalContext.value_map);

          // Check if we need to generate (no URL or cache miss)
          const needsGeneration = !currentStory.backgroundAudio || currentStory.generatedForText !== replacedText;

          if (needsGeneration) {
            console.log('[StoriesComponent] Story needs audio generation:', {
              story: currentStory.name,
              index,
              template: currentStory.audioTexts,
              replaced: replacedText,
              cached: currentStory.generatedForText
            });

            // Show loading and generate audio
            this.showLoading('Generating audio...');

            try {
              const updatedStory = await this.replaceGeneratedAudioUrl(currentStory);

              if (updatedStory) {
                // Update the story in our array
                this.stories[index] = updatedStory;
                console.log('[StoriesComponent] Audio generated successfully for story:', {
                  index,
                  storyName: updatedStory.name,
                  audioUrl: updatedStory.backgroundAudio,
                  generatedFor: updatedStory.generatedForText
                });
              } else {
                console.warn('[StoriesComponent] No audio generated for story:', index);
              }
            } catch (error) {
              console.error('[StoriesComponent] Failed to generate audio for story:', index, error);
              // Continue anyway - show story without audio
            } finally {
              this.hideLoading();
            }
          }
        }

        // Get new story data to check if audio needs to change
        const newStory = this.stories[index];
        const currentAudio = document.getElementById('commonSoundComponent');

        // Stop audio if:
        // 1. New story has no audio (need to stop previous audio)
        // 2. New story has different audio URL than current
        const hasCurrentAudio = currentAudio && currentAudio.src;
        const shouldStopAudio =
          !newStory.backgroundAudio || // No audio in new story, stop current
          (hasCurrentAudio && newStory.backgroundAudio && currentAudio.src !== newStory.backgroundAudio); // Different audio

        if (shouldStopAudio) {
          this.stopBackgroundAudio();
        }

        // Reset media ended flags for new story
        this.mediaEnded.video = false;
        this.mediaEnded.audio = false;

        // Clear progress tracking interval
        if (this.progressInterval) {
          clearInterval(this.progressInterval);
          this.progressInterval = null;
        }

        // Track duration for previous story
        if (this.durationData.currentStoryStartTime && this.config.trackDuration) {
          const duration =
            (Date.now() - this.durationData.currentStoryStartTime) / 1000 - this.durationData.currentStoryInactiveDuration;

          this.durationData.perStory[this.currentIndex] = (this.durationData.perStory[this.currentIndex] || 0) + duration;

          this.durationData.currentStoryInactiveDuration = 0;
        }

        // Show loading state (except for resize)
        if (direction !== 'resize') {
          this.showLoading();
          // Small delay for smooth transition
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Update current index
        this.currentIndex = index;

        // Start tracking duration for new story
        if (this.config.trackDuration) {
          this.durationData.currentStoryStartTime = Date.now();
        }

        // Get story data
        const story = this.stories[index];
        const storyContent = this.container.querySelector('.story-content');

        if (!storyContent) {
          throw new Error('Story content container not found');
        }

        // Stop previous audio
        this.stopCurrentAudio();

        // Update container dimensions before rendering to ensure correct positioning
        this.updateContainerDimensions();

        // Render story content
        storyContent.innerHTML = '';
        const storyElement = this.renderStory(story);
        storyContent.appendChild(storyElement);

        // Attach event listeners
        this.attachEventListeners(story);

        // Update progress bar
        this.updateProgress();

        // Start progress tracking for stories with manual duration
        this.startProgressTracking(story);

        // Hide loading state
        this.hideLoading();

        // Play background audio if available (matches mathai-client pattern)
        if (story.backgroundAudio) {
          console.log('[StoriesComponent] About to play background audio:', {
            story: story.name,
            index,
            audioUrl: story.backgroundAudio,
            generatedFor: story.generatedForText
          });
          this.playBackgroundAudio(story);
        } else {
          console.log('[StoriesComponent] No background audio for story:', story.name);
        }

        // Resume video playback (ensures video plays after navigation, clears paused state)
        // Note: Only resumes video, not audio (audio is handled above)
        const video = this.container.querySelector('.story-background-video');
        if (video && video.paused) {
          const hasEnded = video.duration > 0 && video.currentTime >= video.duration;
          if (!hasEnded) {
            video.play().catch(error => {
              console.warn('[StoriesComponent] Error resuming video:', error);
            });
          }
        }

        // Preload adjacent stories for faster navigation
        this.preloadAdjacentStories();

        // Track story_started event for each slide
        this._trackStoryEvent('story_started');

        // Trigger callback
        if (typeof this.config.onStoryChange === 'function') {
          try {
            this.config.onStoryChange(index, direction, story);
          } catch (error) {
            console.error('[StoriesComponent] onStoryChange callback error:', error);
          }
        }
      } catch (error) {
        this.hideLoading();
        this.handleError(error);
      }
    }

    /**
     * Render a story with background support
     * Matches StoryBlock/index.tsx getBackground implementation (lines 582-598)
     * Supports SOLID_COLOR, LINEAR_COLOR, RADIAL_COLOR, IMAGE, and VIDEO backgrounds
     * @param {Object} story - Story data
     * @returns {HTMLElement} Story element
     */
    renderStory(story) {
      // Apply global variable replacement to story content (StoriesBlock.tsx line 992)
      const replacedStory = this.utils.replaceGlobalVariables(story, this.globalContext.value_map);

      const storyElement = document.createElement('div');
      storyElement.className = 'story-item';
      storyElement.setAttribute('data-story-index', replacedStory.index);
      storyElement.setAttribute('data-story-name', replacedStory.name);

      storyElement.style.cssText = `
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
      `;

      // Handle background based on type (matches StoryBlock getBackground)
      const background = replacedStory.background || {};

      if (background.type) {
        switch (background.type) {
          case 'SOLID_COLOR':
          case 'LINEAR_COLOR':
          case 'RADIAL_COLOR':
            // Apply color/gradient as CSS background
            if (background.value) {
              storyElement.style.background = background.value;
            }
            break;

          case 'IMAGE':
            // Render background image
            if (background.value) {
              const bgImage = document.createElement('div');
              bgImage.className = 'story-background-image';
              bgImage.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url('${background.value}');
                background-size: cover;
                background-position: center;
                z-index: 0;
              `;
              storyElement.appendChild(bgImage);
            }
            break;

          case 'VIDEO':
            // Render background video (matches StoryBlock lines 1231-1251)
            if (background.value) {
              const bgVideo = document.createElement('video');
              bgVideo.className = 'story-background-video';
              bgVideo.id = 'story_background_video';
              bgVideo.src = background.value;
              bgVideo.autoplay = true;
              bgVideo.loop = false; // Never loop background videos
              // Video should be unmuted by default, unless:
              // 1. There's a story audio track (other.audio) AND
              // 2. play_multiple_audio is false (don't play both simultaneously)
              bgVideo.muted = replacedStory.other?.audio && !replacedStory.play_multiple_audio;
              bgVideo.playsInline = true;
              bgVideo.controls = false;
              bgVideo.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
                ${background.default ? `background: ${background.default};` : ''}
              `;
              storyElement.appendChild(bgVideo);

              // Track video progress for progress bar
              bgVideo.addEventListener('timeupdate', () => {
                if (bgVideo.duration > 0) {
                  const percentage = (bgVideo.currentTime / bgVideo.duration) * 100;
                  this.updateProgress(percentage);
                }
              });

              // Track video ended event
              bgVideo.addEventListener('ended', () => {
                console.log('[StoriesComponent] Background video ended');
                this.mediaEnded.video = true;
                this.checkMediaEndedAndAdvance(replacedStory);
              });

              // Track video load errors
              bgVideo.addEventListener('error', e => {
                console.error('[StoriesComponent] Background video load error:', background.value);
                this.handleMediaLoadError('video', background.value, e);
              });

              // Explicitly play video after appending to DOM
              // Use setTimeout to ensure DOM is ready
              setTimeout(() => {
                bgVideo.play().catch(error => {
                  console.warn('[StoriesComponent] Background video autoplay blocked:', error);
                  console.log('[StoriesComponent] Video was unmuted:', !bgVideo.muted);

                  // Check if it's a permission error - show popup instead of muting
                  if (error.name === 'NotAllowedError') {
                    this.handleMediaPermissionError('video');
                    return; // Don't try muted fallback
                  }

                  // If autoplay fails with audio (but not permission error), try muting as fallback
                  if (!bgVideo.muted) {
                    console.log('[StoriesComponent] Browser blocked unmuted autoplay, retrying with muted video');
                    bgVideo.muted = true;
                    bgVideo.play().catch(err => {
                      console.error('[StoriesComponent] Video playback failed even when muted:', err);

                      // Check again for permission error
                      if (err.name === 'NotAllowedError') {
                        this.handleMediaPermissionError('video');
                      }
                    });
                  } else {
                    // Video was already muted but still failed
                    console.error('[StoriesComponent] Muted video playback failed:', error);
                  }
                });
              }, 100);
            }
            break;
        }
      }

      // Create elements container
      const elementsContainer = document.createElement('div');
      elementsContainer.className = 'story-elements';
      elementsContainer.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        z-index: 10;
      `;

      // Render story elements (with replaced content)
      if (replacedStory.elements && Array.isArray(replacedStory.elements)) {
        replacedStory.elements.forEach(elementData => {
          const element = this.renderElement(elementData, this.containerDimensions);
          if (element) {
            elementsContainer.appendChild(element);
          }
        });
      }

      storyElement.appendChild(elementsContainer);

      return storyElement;
    }

    /**
     * Render an individual element
     * Updated to match mathai-client element structure with type detection
     * @param {Object} elementData - Element data with {type, data, other}
     * @param {Object} containerDims - Container dimensions
     * @returns {HTMLElement|null} Rendered element
     */
    renderElement(elementData, containerDims) {
      // Element type is at the root level
      const type = elementData.type;

      if (!type) {
        console.warn('[StoriesComponent] Element missing type:', elementData);
        return null;
      }

      // Convert type to renderer function name
      // Handle special case for v2_avatar and v2_rich_text
      let rendererName;
      if (type === 'v2_avatar') {
        rendererName = 'renderV2_avatar';
      } else if (type === 'v2_rich_text') {
        rendererName = 'renderV2_rich_text';
      } else {
        // Capitalize first letter for other types (button, image, input)
        rendererName = `render${type.charAt(0).toUpperCase()}${type.slice(1)}`;
      }

      const renderer = this.renderers[rendererName];

      if (!renderer) {
        console.warn(`[StoriesComponent] No renderer for type: ${type}`);
        return null;
      }

      try {
        // Pass the full elementData object so renderers can access data, other, etc.
        return renderer.call(this, elementData, containerDims);
      } catch (error) {
        console.error(`[StoriesComponent] Error rendering ${type}:`, error);
        return null;
      }
    }

    /**
     * Attach event listeners to story elements
     * @param {Object} story - Story data
     */
    attachEventListeners(story) {
      const storyContent = this.container.querySelector('.story-content');
      if (!storyContent) return;

      // Attach button click handlers
      const buttons = storyContent.querySelectorAll('[data-element-type="button"]');
      buttons.forEach(button => {
        const name = button.getAttribute('data-button-name');
        const actionStr = button.getAttribute('data-button-action');

        button.addEventListener('click', () => {
          const action = actionStr ? JSON.parse(actionStr) : null;
          this.handleButtonClick(name, action);
        });
      });

      // Attach input change handlers
      const inputs = storyContent.querySelectorAll('[data-element-type="input"]');
      inputs.forEach(input => {
        const name = input.getAttribute('data-input-name');
        let hasTrackedInputStart = false;

        input.addEventListener('change', e => {
          this.handleInputChange(name, e.target.value);
        });

        input.addEventListener('input', e => {
          // Track story_input_stated only once per input field
          if (!hasTrackedInputStart && e.target.value) {
            hasTrackedInputStart = true;
            this._trackStoryEvent('story_input_stated', {
              data_of_input: JSON.stringify({ [name]: e.target.value })
            });
          }
          this.handleInputChange(name, e.target.value);
        });
      });
    }

    /**
     * Setup navigation click areas for prev/next story navigation
     */
    setupNavigationAreas() {
      const navLeft = this.container.querySelector('.story-nav-left');
      const navRight = this.container.querySelector('.story-nav-right');

      // Long press tracking
      let longPressTimer = null;
      const LONG_PRESS_DURATION = 200; // milliseconds

      // Handle long press start
      const handlePressStart = e => {
        // removed prevent default to allow clicks on button 
        // e.preventDefault();
        longPressTimer = setTimeout(() => {
          this.pauseBackgroundVideo();

          // Track story_paused immediately when paused
          this._trackStoryEvent('story_paused');
        }, LONG_PRESS_DURATION);
      };

      // Handle long press end
      const handlePressEnd = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        this.resumeBackgroundVideo();
      };

      // Setup long press for entire container (works anywhere on screen)
      // Touch events
      this.container.addEventListener('touchstart', handlePressStart, { passive: false });
      this.container.addEventListener('touchend', handlePressEnd);
      this.container.addEventListener('touchcancel', handlePressEnd);

      // Mouse events (for desktop)
      this.container.addEventListener('mousedown', handlePressStart);
      this.container.addEventListener('mouseup', handlePressEnd);
      this.container.addEventListener('mouseleave', handlePressEnd);

      // Setup navigation with both click and long press support
      if (navLeft) {
        let navLeftTimer = null;
        let navLeftLongPress = false;

        const handleNavLeftStart = e => {
          // Always stop propagation on navigation areas
          e.stopPropagation();

          navLeftLongPress = false;
          // Only start timer if there's a previous story to navigate to
          navLeftTimer = setTimeout(() => {
            navLeftLongPress = true;
            this.pauseBackgroundVideo();
          }, LONG_PRESS_DURATION);
        };

        const handleNavLeftEnd = e => {
          // Always stop propagation on navigation areas
          e.stopPropagation();

          if (navLeftTimer) {
            clearTimeout(navLeftTimer);
            navLeftTimer = null;
          }

          if (navLeftLongPress) {
            // Was a long press, resume video
            this.resumeBackgroundVideo();
          } else {
            // Was a click, navigate to previous using history
            // Prevent rage clicking - check if already navigating
            if (this.isNavigating) {
              console.log('[StoriesComponent] Navigation in progress, ignoring click');
              return;
            }

            if (this.history.length > 0) {
              this.isNavigating = true;
              this.prev();

              // Reset navigation flag after cooldown
              setTimeout(() => {
                this.isNavigating = false;
              }, this.navigationCooldown);
            }
          }
        };

        // Touch events
        navLeft.addEventListener('touchstart', handleNavLeftStart, { passive: false });
        navLeft.addEventListener('touchend', handleNavLeftEnd);
        navLeft.addEventListener('touchcancel', handleNavLeftEnd);

        // Mouse events
        navLeft.addEventListener('mousedown', handleNavLeftStart);
        navLeft.addEventListener('mouseup', handleNavLeftEnd);
      }

      if (navRight) {
        let navRightTimer = null;
        let navRightLongPress = false;

        const handleNavRightStart = e => {
          // Always stop propagation on navigation areas
          e.stopPropagation();

          navRightLongPress = false;
          // Only start timer if there's a next story to navigate to
          navRightTimer = setTimeout(() => {
            navRightLongPress = true;
            this.pauseBackgroundVideo();
          }, LONG_PRESS_DURATION);
        };

        const handleNavRightEnd = e => {
          // Always stop propagation on navigation areas
          e.stopPropagation();

          if (navRightTimer) {
            clearTimeout(navRightTimer);
            navRightTimer = null;
          }

          if (navRightLongPress) {
            // Was a long press, resume video
            this.resumeBackgroundVideo();
          } else {
            // Was a click, navigate to next (only if there's a next story)
            // Prevent rage clicking - check if already navigating
            if (this.isNavigating) {
              console.log('[StoriesComponent] Navigation in progress, ignoring click');
              return;
            }

            const nextIndex = this.currentIndex + 1;
            if (nextIndex <= this.stories.length) {
              this.isNavigating = true;
              this.next({}, true); // true = manual skip by user

              // Reset navigation flag after cooldown
              setTimeout(() => {
                this.isNavigating = false;
              }, this.navigationCooldown);
            }
          }
        };

        // Touch events
        navRight.addEventListener('touchstart', handleNavRightStart, { passive: false });
        navRight.addEventListener('touchend', handleNavRightEnd);
        navRight.addEventListener('touchcancel', handleNavRightEnd);

        // Mouse events
        navRight.addEventListener('mousedown', handleNavRightStart);
        navRight.addEventListener('mouseup', handleNavRightEnd);
      }
    }

    /**
     * Handle button click
     * @param {string} name - Button name
     * @param {Object} action - Button action
     */
    async handleButtonClick(name, action) {
      try {
        console.log('[StoriesComponent] Button clicked:', name, action);

        // Handle action types based on actual production format
        if (action) {
          const actionType = action.type?.trim();

          if (actionType === 'internal') {
            // Track story_input_filled before navigating
            const inputData = { ...this.inputs };
            // Remove undefined values
            Object.keys(inputData).forEach(key => {
              if (inputData[key] === undefined) delete inputData[key];
            });

            this._trackStoryEvent('story_input_filled', {
              data_of_input: inputData,
              button_name: name,
              button_text: action.text || ''
            });

            // Internal action: Navigate to next story with button name as compute input
            // This triggers compute functions to determine the next story
            await this.next({ [name]: true });
          } else if (actionType === 'external' && action.value) {
            // External action: Navigate to URL
            const openInNewTab = !action.open_in_same_tab;

            // Use onNavigate callback if provided (for SPA navigation without reload)
            if (typeof this.config.onNavigate === 'function') {
              this.config.onNavigate(action.value, openInNewTab);
            } else if (openInNewTab) {
              // New tab navigation
              window.open(action.value, '_blank');
            } else {
              // Same tab navigation (fallback)
              window.location.href = action.value;
            }
          }
        }

        // Trigger external callback for analytics/tracking if provided
        if (typeof this.config.onButtonClick === 'function') {
          try {
            this.config.onButtonClick(name, action, this.currentIndex);
          } catch (error) {
            console.error('[StoriesComponent] onButtonClick callback error:', error);
          }
        }
      } catch (error) {
        this.handleError(error);
      }
    }

    /**
     * Handle input change
     * Updates global context and triggers re-render if content uses that variable (task 6)
     * @param {string} name - Input name
     * @param {*} value - Input value
     */
    handleInputChange(name, value) {
      try {
        // Store input value
        this.inputs[name] = value;

        // Update global context
        const prevContext = { ...this.globalContext.value_map };
        this.updateGlobalContext({ [name]: value });

        // Check if current story content uses this variable
        const currentStory = this.stories[this.currentIndex];
        if (currentStory) {
          // Simple check: see if story contains @@variableName@@
          const storyJSON = JSON.stringify(currentStory);
          if (storyJSON.includes(`@@${name}@@`)) {
            // Re-render current story with updated context
            console.log(`[StoriesComponent] Re-rendering story due to variable change: ${name}`);
            this.showStory(this.currentIndex, 'update');
          }
        }

        // Trigger external callback
        if (typeof this.config.onInputChange === 'function') {
          try {
            this.config.onInputChange(name, value, this.currentIndex);
          } catch (error) {
            console.error('[StoriesComponent] onInputChange callback error:', error);
          }
        }
      } catch (error) {
        this.handleError(error);
      }
    }

    /**
     * Execute getNextStory compute function
     * @param {Object} inputs - Input values
     * @returns {*} Result from compute function
     */
    executeGetNextStory(inputs = {}) {
      const story = this.stories[this.currentIndex];

      if (!story.getNextStory) {
        return null;
      }

      try {
        // Prepare parameters for compute function
        const params = {
          history: this.history.slice(),
          inputs: { ...this.inputs, ...inputs },
          global_context_variables: { ...this.globalContext.value_map },
          publishEvent: (eventName, eventData) => {
            console.log('[StoriesComponent] Event:', eventName, eventData);
          }
        };

        // Execute compute function
        const result = this.utils.executeComputeFunction(story.getNextStory, params);

        console.log('[StoriesComponent] getNextStory result:', result);
        return result;
      } catch (error) {
        console.error('[StoriesComponent] getNextStory execution error:', error);
        this.handleError(error);
        return null;
      }
    }

    /**
     * Navigate to next story
     * Matches StoriesBlock.tsx handleNextStory pattern
     * @param {Object} inputs - Input values to pass to compute function
     */
    async next(inputs = {}, isManualSkip = false) {
      try {
        // Get current story name for tracking
        const currentStory = this.stories[this.currentIndex];
        const storyName = currentStory?.name || `story_slide_${this.currentIndex}`;

        // Create story data object for tracking (StoriesBlock format)
        const storyData = {
          [storyName]: { ...this.inputs, ...inputs }
        };

        // Add to storiesArray (history of completed stories with inputs)
        this.storiesArray.push(storyData);

        // Update storiesMap (map of story names to input values)
        this.storiesMap = {
          ...this.storiesMap,
          ...storyData
        };

        // Add current story to navigation history
        this.history.push({
          index: this.currentIndex,
          inputs: { ...this.inputs },
          globalContext: { ...this.globalContext.value_map },
          timestamp: Date.now()
        });

        // Execute getNextStory compute function if available
        const nextStoryResult = this.executeGetNextStory(inputs);

        let nextIndex = null;

        // Determine next story index
        if (nextStoryResult !== null && nextStoryResult !== undefined) {
          // Check for "end" or "END" - story sequence should end immediately
          if (typeof nextStoryResult === 'string' && nextStoryResult.toLowerCase() === 'end') {
            console.log('[StoriesComponent] getNextStory returned END - completing story sequence');
            this.complete();
            return;
          }

          if (typeof nextStoryResult === 'number') {
            // Direct index
            nextIndex = nextStoryResult;
          } else if (typeof nextStoryResult === 'string') {
            // Story name - lookup in storiesMap (now an object, not Map)
            nextIndex = this.stories.findIndex(s => s.name === nextStoryResult);
            if (nextIndex === -1) {
              console.warn(`[StoriesComponent] Story not found: ${nextStoryResult}`);
              nextIndex = this.currentIndex + 1;
            }
          } else if (typeof nextStoryResult === 'object' && nextStoryResult.story) {
            // Check for "end" in object format
            const storyRef = nextStoryResult.story;
            if (typeof storyRef === 'string' && storyRef.toLowerCase() === 'end') {
              console.log('[StoriesComponent] getNextStory returned END - completing story sequence');
              this.complete();
              return;
            }

            // Object with story property
            if (typeof storyRef === 'number') {
              nextIndex = storyRef;
            } else if (typeof storyRef === 'string') {
              nextIndex = this.stories.findIndex(s => s.name === storyRef);
            }
          }
        }

        // Default to next sequential story
        if (nextIndex === null || nextIndex === undefined || nextIndex === -1) {
          nextIndex = this.currentIndex + 1;
        }

        // Check if we've reached the end
        if (nextIndex >= this.stories.length) {
          this.complete();
          return;
        }

        // Track story_ended for current slide before navigating
        this._trackStoryEvent('story_ended');

        // Track story_skip_tapped ONLY if user manually skipped (not auto-advance)
        if (isManualSkip && currentStory?.is_skip !== false) {
          this._trackStoryEvent('story_skip_tapped');
        }

        // Reset retry tracking and error state when moving to a new story
        this.retryingStoryIndex = null;
        this.errorCount = 0;
        this.isContentError = false;
        this.isNetworkOffline = false;
        this.failedMediaUrls = [];
        this.errorPopupShowing = false;
        this.isRetrying = false;

        console.log('[StoriesComponent] Moving to next story, reset all error state');

        // Navigate to next story
        await this.showStory(nextIndex, 'next');
      } catch (error) {
        this.handleError(error);
      }
    }

    /**
     * Navigate to previous story
     */
    async prev() {
      try {
        if (this.history.length === 0) {
          console.warn('[StoriesComponent] No previous story in history');
          return;
        }

        // Track story_ended for current slide before navigating
        this._trackStoryEvent('story_ended');

        // Track story_go_to_prev_tapped before navigating
        this._trackStoryEvent('story_go_to_prev_tapped');

        // Reset retry tracking and error state when moving to previous story
        this.retryingStoryIndex = null;
        this.errorCount = 0;
        this.isContentError = false;
        this.isNetworkOffline = false;
        this.failedMediaUrls = [];
        this.errorPopupShowing = false;
        this.isRetrying = false;

        console.log('[StoriesComponent] Moving to previous story, reset all error state');

        // Get previous story from history
        const prevState = this.history.pop();

        // Restore state
        this.inputs = { ...prevState.inputs };
        this.globalContext.value_map = { ...prevState.globalContext };

        // Navigate to previous story
        await this.showStory(prevState.index, 'prev');
      } catch (error) {
        this.handleError(error);
      }
    }

    /**
     * Jump to a specific story
     * @param {number|string} storyNameOrIndex - Story name or index
     * @param {Object} inputs - Input values
     */
    async jumpTo(storyNameOrIndex, inputs = {}) {
      try {
        let targetIndex;

        if (typeof storyNameOrIndex === 'number') {
          targetIndex = storyNameOrIndex;
        } else if (typeof storyNameOrIndex === 'string') {
          targetIndex = this.storiesMap.get(storyNameOrIndex);
          if (targetIndex === undefined) {
            throw new Error(`Story not found: ${storyNameOrIndex}`);
          }
        } else {
          throw new Error('Invalid story reference');
        }

        // Validate index
        if (targetIndex < 0 || targetIndex >= this.stories.length) {
          throw new Error(`Invalid story index: ${targetIndex}`);
        }

        // Add current story to history
        this.history.push({
          index: this.currentIndex,
          inputs: { ...this.inputs },
          globalContext: { ...this.globalContext.value_map },
          timestamp: Date.now()
        });

        // Update inputs if provided
        if (inputs && Object.keys(inputs).length > 0) {
          this.inputs = { ...this.inputs, ...inputs };
        }

        // Navigate to target story
        await this.showStory(targetIndex, 'jump');
      } catch (error) {
        this.handleError(error);
      }
    }

    /**
     * Update global context
     * @param {Object} updates - Updates to merge into global context
     */
    updateGlobalContext(updates) {
      if (!updates || typeof updates !== 'object') return;

      this.globalContext.value_map = {
        ...this.globalContext.value_map,
        ...updates
      };

      console.log('[StoriesComponent] Global context updated:', this.globalContext.value_map);
    }

    /**
     * Get global context
     * @returns {Object} Global context
     */
    getGlobalContext() {
      return { ...this.globalContext };
    }

    /**
     * Play background audio for story (matches mathai-client pattern)
     * Uses the global commonSoundComponent audio element
     * @param {Object} story - Story data
     */
    playBackgroundAudio(story) {
      const audio = document.getElementById('commonSoundComponent');
      if (!audio) {
        console.warn('[StoriesComponent] commonSoundComponent audio element not found');
        return;
      }

      const backgroundAudio = story.backgroundAudio;
      if (!backgroundAudio) {
        console.log('[StoriesComponent] No background audio for story:', story.name);
        return;
      }

      try {
        console.log('[StoriesComponent] Playing background audio:', backgroundAudio, 'for story:', story.name);

        // Reset audio state
        audio.pause();
        audio.currentTime = 0;
        audio.loop = false; // Never loop background audio

        // Handle audio ended event
        audio.onended = () => {
          console.log('[StoriesComponent] Background audio ended');
          this.mediaEnded.audio = true;
          this.checkMediaEndedAndAdvance(story);
        };

        // Handle audio load errors
        audio.onerror = e => {
          console.error('[StoriesComponent] Background audio load error:', backgroundAudio);
          this.handleMediaLoadError('audio', backgroundAudio, e);
        };

        // Track audio progress for progress bar (if no video)
        const hasBackgroundVideo = story.background?.type === 'VIDEO' && story.background?.value;
        if (!hasBackgroundVideo) {
          audio.ontimeupdate = () => {
            if (audio.duration > 0) {
              const percentage = (audio.currentTime / audio.duration) * 100;
              this.updateProgress(percentage);
            }
          };
        } else {
          // Clear ontimeupdate if video handles progress
          audio.ontimeupdate = null;
        }

        // Always set src (we now clear it in stopBackgroundAudio)
        audio.src = backgroundAudio;

        // Play immediately - browser will handle loading
        audio.play().catch(error => {
          console.warn('[StoriesComponent] Background audio autoplay blocked:', error);

          // Check if it's a permission error
          if (error.name === 'NotAllowedError') {
            this.handleMediaPermissionError('audio');
          }
        });
      } catch (error) {
        console.error('[StoriesComponent] Error playing background audio:', error);
      }
    }

    /**
     * Stop background audio
     */
    stopBackgroundAudio() {
      const audio = document.getElementById('commonSoundComponent');
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = ''; // Clear src to fully stop audio
        audio.onended = null;
        audio.ontimeupdate = null;
      }
    }

    /**
     * Generate audio using TTS API (ElevenLabs)
     * Matches mathai-client getTextToAudios implementation
     * @param {string} text - Text to convert to speech (variables already replaced)
     * @param {Object} config - Audio configuration {language, artist, client}
     * @returns {Promise<string>} Generated audio URL
     */
    async generateAudio(text, config = {}) {
      const endpoint = this.config.ttsEndpoint + '/v3/personalizedLearning/generateTextsToAudios';

      const payload = {
        data: [
          {
            client: config.client || 'ElevenLabs',
            text: text,
            language: config.language || 'Hindi',
            artist: config.artist || {
              name: 'Madhu',
              other: {
                voice_id: 'XeXqtVbGZphseIE5t8Ga'
              }
            }
          }
        ]
      };

      try {
        console.log('[StoriesComponent] Generating audio for text:', text);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const audioUrl = result.data?.[text]?.audio_url;

        if (!audioUrl) {
          throw new Error('No audio URL in TTS response');
        }

        console.log('[StoriesComponent] Audio generated successfully:', audioUrl);
        return audioUrl;
      } catch (error) {
        console.error('[StoriesComponent] Audio generation error:', error);
        throw error;
      }
    }

    /**
     * Replace generated audio URL for a story with dynamic text
     * Matches mathai-client replaceGeneratedAudioUrl implementation
     * @param {Object} story - Story object to update
     * @returns {Promise<Object|null>} Updated story or null if no generation needed
     */
    async replaceGeneratedAudioUrl(story) {
      // Check if story has audio text configuration
      if (!story.audioTexts) {
        return null;
      }

      // Check if text contains dynamic variables
      if (!this.utils.hasDynamicText(story.audioTexts)) {
        return null;
      }

      // Replace variables with global context values
      const replacedText = this.utils.replaceDynamicText(story.audioTexts, this.globalContext.value_map);

      // Check cache - don't regenerate if already generated for this text
      if (story.generatedForText === replacedText && story.backgroundAudio) {
        console.log('[StoriesComponent] Using cached audio for:', replacedText);
        return null;
      }

      try {
        // Generate audio via TTS API
        const audioUrl = await this.generateAudio(replacedText, {
          language: story.audioLanguage,
          artist: story.audioArtist,
          client: 'ElevenLabs'
        });

        // Update story with generated audio URL
        const updatedStory = {
          ...story,
          backgroundAudio: audioUrl,
          generatedForText: replacedText
        };

        console.log('[StoriesComponent] Story audio updated:', {
          story: story.name,
          text: replacedText,
          url: audioUrl
        });

        return updatedStory;
      } catch (error) {
        console.error('[StoriesComponent] Failed to generate audio for story:', story.name, error);
        return null;
      }
    }

    /**
     * Get updated stories with generated audio
     * Matches mathai-client getUpdatedStories implementation
     * @param {number} currentIndex - Current story index
     * @returns {Promise<Array>} Array of {idx, story} objects with generated audio
     */
    async getUpdatedStories(currentIndex) {
      // Check gen_audio_map for stories needing generation at this index
      if (!this.genAudioMap || !this.genAudioMap[currentIndex]) {
        return [];
      }

      const storiesToGenerate = this.genAudioMap[currentIndex];
      if (!Array.isArray(storiesToGenerate) || storiesToGenerate.length === 0) {
        return [];
      }

      console.log('[StoriesComponent] Generating audio for stories:', storiesToGenerate);

      // Generate audio for each story in parallel
      const promises = storiesToGenerate.map(async item => {
        const storyIdx = item.story_idx;
        const story = this.stories[storyIdx];

        if (!story) {
          console.warn('[StoriesComponent] Story not found at index:', storyIdx);
          return null;
        }

        const updatedStory = await this.replaceGeneratedAudioUrl(story);

        if (updatedStory) {
          return { idx: storyIdx, story: updatedStory };
        }

        return null;
      });

      const results = await Promise.all(promises);

      // Filter out null results
      return results.filter(result => result !== null);
    }

    /**
     * Resume navigation after audio generation completes
     * Matches mathai-client resume flow
     */
    async resumeAfterAudioGeneration() {
      if (!this.storyStoppedAt) {
        console.warn('[StoriesComponent] No navigation to resume');
        return;
      }

      console.log('[StoriesComponent] Resuming navigation after audio generation');

      const { index, direction } = this.storyStoppedAt;

      // Clear state
      this.loadingGeneratedAudio = false;
      this.storyStoppedAt = null;
      this.generateAudioMap = null;

      // Resume navigation
      await this.showStory(index, direction);
    }

    /**
     * Check if all media has ended and auto-advance if appropriate
     * Waits for BOTH video and audio to end if both exist
     * @param {Object} story - Story data
     */
    checkMediaEndedAndAdvance(story) {
      const hasVideo = story.background?.type === 'VIDEO' && story.background?.value;
      const hasAudio = story.backgroundAudio;

      console.log('[StoriesComponent] Checking media completion:', {
        hasVideo,
        hasAudio,
        videoEnded: this.mediaEnded.video,
        audioEnded: this.mediaEnded.audio,
        is_skip: story.is_skip
      });

      // Determine if we should auto-advance
      let shouldAdvance = false;

      if (hasVideo && hasAudio) {
        // Both video and audio exist - wait for BOTH to finish
        shouldAdvance = this.mediaEnded.video && this.mediaEnded.audio;
        console.log('[StoriesComponent] Both video and audio exist, waiting for both to finish');
      } else if (hasVideo) {
        // Only video exists
        shouldAdvance = this.mediaEnded.video;
        console.log('[StoriesComponent] Only video exists, checking if video finished');
      } else if (hasAudio) {
        // Only audio exists
        shouldAdvance = this.mediaEnded.audio;
        console.log('[StoriesComponent] Only audio exists, checking if audio finished');
      }

      // Auto-advance if conditions are met
      if (shouldAdvance && story.is_skip !== false) {
        console.log('[StoriesComponent] All media finished, auto-advancing to next story');
        this.next({}, false); // false = auto-advance (not manual skip)
      } else if (shouldAdvance && story.is_skip === false) {
        console.log('[StoriesComponent] All media finished, but auto-advance disabled (is_skip: false)');
      }
    }

    /**
     * Play story audio
     * @param {Object} story - Story data
     */
    async playStoryAudio(story) {
      if (!this.audioManager) return;

      const audioId = story.audioId || story.audio;
      if (!audioId) return;

      try {
        // Stop current audio
        this.stopCurrentAudio();

        // Play new audio
        this.currentAudioId = audioId;

        if (this.audioManager.has(audioId)) {
          await this.audioManager.play(audioId, {
            priority: 10,
            triggerSource: 'story'
          });
        } else {
          console.warn(`[StoriesComponent] Audio not found: ${audioId}`);
        }
      } catch (error) {
        console.error('[StoriesComponent] Error playing audio:', error);
      }
    }

    /**
     * Stop current audio
     */
    stopCurrentAudio() {
      if (!this.audioManager || !this.currentAudioId) return;

      try {
        this.audioManager.stopAll();
        this.currentAudioId = null;
      } catch (error) {
        console.warn('[StoriesComponent] Error stopping audio:', error);
      }
    }

    /**
     * Pause background video during long press
     */
    pauseBackgroundVideo() {
      this.isPaused = true;

      const video = this.container.querySelector('.story-background-video');
      if (video && !video.paused) {
        try {
          video.pause();
          console.log('[StoriesComponent] Background video paused');
        } catch (error) {
          console.warn('[StoriesComponent] Error pausing background video:', error);
        }
      }

      // Pause background audio
      const audio = document.getElementById('commonSoundComponent');
      if (audio && !audio.paused) {
        try {
          audio.pause();
          console.log('[StoriesComponent] Background audio paused');
        } catch (error) {
          console.warn('[StoriesComponent] Error pausing background audio:', error);
        }
      }

      // Pause progress tracking interval
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
        this.progressPausedAt = Date.now();
      }

      // Also pause audio if playing
      if (this.audioManager && this.currentAudioId) {
        try {
          this.audioManager.pause();
        } catch (error) {
          console.warn('[StoriesComponent] Error pausing audio:', error);
        }
      }
    }

    /**
     * Resume background video after long press
     */
    resumeBackgroundVideo() {
      this.isPaused = false;

      const video = this.container.querySelector('.story-background-video');
      if (video && video.paused) {
        // Don't resume if video has ended
        const hasEnded = video.duration > 0 && video.currentTime >= video.duration;
        if (!hasEnded) {
          try {
            video.play();
            console.log('[StoriesComponent] Background video resumed');
          } catch (error) {
            console.warn('[StoriesComponent] Error resuming background video:', error);
          }
        } else {
          console.log('[StoriesComponent] Background video already ended, not resuming');
        }
      }

      // Resume background audio (only if not ended)
      const audio = document.getElementById('commonSoundComponent');
      if (audio && audio.paused && audio.src) {
        // Don't resume if audio has ended (currentTime at duration)
        const hasEnded = audio.duration > 0 && audio.currentTime >= audio.duration;
        if (!hasEnded) {
          try {
            audio.play();
            console.log('[StoriesComponent] Background audio resumed');
          } catch (error) {
            console.warn('[StoriesComponent] Error resuming background audio:', error);
          }
        } else {
          console.log('[StoriesComponent] Background audio already ended, not resuming');
        }
      }

      // Resume progress tracking interval if it was paused
      if (this.progressPausedAt && this.currentIndex >= 0) {
        const story = this.stories[this.currentIndex];
        if (story && story.is_skip !== false) {
          const hasBackgroundVideo = story.background?.type === 'VIDEO' && story.background?.value;

          // Only resume interval for non-video stories
          if (!hasBackgroundVideo) {
            this.startProgressTracking(story);
          }
        }
        this.progressPausedAt = null;
      }

      // Also resume audio if it was playing
      if (this.audioManager && this.currentAudioId) {
        try {
          this.audioManager.resume();
        } catch (error) {
          console.warn('[StoriesComponent] Error resuming audio:', error);
        }
      }
    }

    /**
     * Handle media permission error (NotAllowedError)
     * Shows permission popup and pauses all media
     */
    async handleMediaPermissionError(mediaType) {
      // Prevent showing multiple popups
      if (this.isShowingPermissionPopup) {
        return;
      }

      this.isShowingPermissionPopup = true;

      // Pause all media immediately
      this.pauseAllMedia();

      // Show permission popup using PopupComponent directly
      if (window.PopupComponent) {
        const self = this; // Preserve this context

        // Track if we've already handled the click
        let clickHandled = false;

        window.PopupComponent.show({
          icon: 'https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/animations/audio.json',
          title: 'Permission to play audio',
          description: 'Please click okay to enable sound',
          primaryText: 'Okay!',
          hasSecondary: false,
          primaryClick: function () {
            if (clickHandled) {
              return;
            }
            clickHandled = true;

            // Hide popup first
            window.PopupComponent.hide();

            // Wait for popup hide animation (200ms) to complete, then resume media
            setTimeout(function () {
              self.resumeAllMedia();
              self.isShowingPermissionPopup = false;
            }, 250);
          },
          onShow: function () {
            // Add a backup click handler to the button directly
            setTimeout(function () {
              const button = document.querySelector('#popup-layout button');
              if (button) {
                button.addEventListener(
                  'click',
                  function handleClick(e) {
                    if (clickHandled) {
                      return;
                    }
                    clickHandled = true;

                    // Stop propagation to prevent other handlers
                    e.stopImmediatePropagation();

                    // Method 1: Use PopupComponent.hide()
                    if (window.PopupComponent && window.PopupComponent.hide) {
                      window.PopupComponent.hide();
                    }

                    // Method 2: Manually remove the popup backdrop
                    setTimeout(function () {
                      const backdrop = document.getElementById('popup-backdrop');
                      if (backdrop) {
                        backdrop.remove();
                      }

                      const popupLayout = document.getElementById('popup-layout');
                      if (popupLayout) {
                        popupLayout.remove();
                      }
                    }, 50);

                    // Resume media after delay
                    setTimeout(function () {
                      self.resumeAllMedia();
                      self.isShowingPermissionPopup = false;
                    }, 250);

                    button.removeEventListener('click', handleClick, true);
                  },
                  true
                ); // Use capture phase to intercept before other handlers
              } else {
                console.warn('[StoriesComponent] Could not find popup button');
              }
            }, 100);
          }
        });
      } else {
        console.warn('[StoriesComponent] PopupComponent not available');
        this.isShowingPermissionPopup = false;
      }
    }

    /**
     * Handle media load errors (video/audio failed to load)
     * @param {string} mediaType - 'video' or 'audio'
     * @param {string} url - URL that failed to load
     * @param {Event} errorEvent - Error event object
     */
    handleMediaLoadError(mediaType, url, errorEvent) {
      // Extract error details from the event
      let errorMessage = 'Unknown error';
      let errorCode = null;

      // For video/audio elements, error info is in target.error
      if (errorEvent && errorEvent.target && errorEvent.target.error) {
        const mediaError = errorEvent.target.error;
        errorCode = mediaError.code;

        // Map error codes to messages
        switch (mediaError.code) {
          case 1: // MEDIA_ERR_ABORTED
            errorMessage = 'Media loading aborted';
            break;
          case 2: // MEDIA_ERR_NETWORK
            errorMessage = 'Network error while loading media';
            break;
          case 3: // MEDIA_ERR_DECODE
            errorMessage = 'Media decoding failed';
            break;
          case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
            errorMessage = 'Media format not supported or source not found';
            break;
          default:
            errorMessage = mediaError.message || 'Unknown media error';
        }
      }

      console.error(`[StoriesComponent] ${mediaType} load error:`, {
        url,
        errorCode,
        errorMessage,
        event: errorEvent
      });

      // Ignore empty src attribute errors - don't show popup
      const mediaError = errorEvent?.target?.error;
      if (mediaError?.message?.includes('Empty src attribute')) {
        console.warn(`[StoriesComponent] Ignoring empty src attribute error for ${mediaType}:`, url);
        return;
      }

      // Check if network is offline
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      // Update error state
      this.isContentError = true;
      this.isNetworkOffline = isOffline;

      // Track which story is failing (for retry limit)
      if (this.retryingStoryIndex === null || this.retryingStoryIndex !== this.currentIndex) {
        // New story failure - reset error count
        console.log(`[StoriesComponent] New story failure detected. Previous: ${this.retryingStoryIndex}, Current: ${this.currentIndex}. Resetting errorCount from ${this.errorCount} to 0`);
        this.retryingStoryIndex = this.currentIndex;
        this.errorCount = 0;
      } else {
        console.log(`[StoriesComponent] Same story failing again. Story: ${this.currentIndex}, errorCount: ${this.errorCount}`);
      }

      // Track failed URL (avoid duplicates) with error details
      if (!this.failedMediaUrls.find(item => item.url === url)) {
        this.failedMediaUrls.push({
          type: mediaType,
          url,
          errorCode,
          errorMessage
        });
      }

      // Show error popup
      this.showMediaErrorPopup();
    }

    /**
     * Show media load error popup (matching mathai-client pattern)
     */
    showMediaErrorPopup() {
      // Don't show if permission popup is already showing
      if (this.isShowingPermissionPopup) {
        console.log('[StoriesComponent] Permission popup showing, skipping error popup');
        return;
      }

      // Don't show multiple error popups
      if (this.errorPopupShowing) {
        console.log('[StoriesComponent] Error popup already showing, skipping duplicate');
        return;
      }

      // Don't show popup during retry - wait for retry to complete
      if (this.isRetrying) {
        console.log('[StoriesComponent] Currently retrying, skipping popup');
        return;
      }

      // Check if PopupComponent is available
      if (!window.PopupComponent) {
        console.warn('[StoriesComponent] PopupComponent not available for error popup');
        return;
      }

      this.errorPopupShowing = true;

      // Pause all media
      this.pauseAllMedia();

      const self = this;

      // Determine icon and title based on error type
      const isContentErrorOnly = this.isContentError && !this.isNetworkOffline;
      const icon = isContentErrorOnly
        ? 'https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/animations/reload.json'
        : 'https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/animations/no-internet.json';
      const title = isContentErrorOnly ? 'Failed to load!' : 'Internet not working';
      const description = 'Please try again';

      // Track retry_popup_visible event
      this._trackStoryEvent('retry_popup_visible', {
        error_type: isContentErrorOnly ? 'content_error' : 'network_error',
        is_offline: this.isNetworkOffline,
        failed_media_count: this.failedMediaUrls.length,
        failed_media_urls: this.failedMediaUrls.map(item => item.url),
        failed_media_details: this.failedMediaUrls.map(item => ({
          type: item.type,
          url: item.url,
          error_code: item.errorCode,
          error_message: item.errorMessage
        })),
        error_count: this.errorCount
      });

      window.PopupComponent.show({
        icon: icon,
        title: title,
        description: description,
        primaryText: 'Retry!',
        hasSecondary: false,
        primaryClick: function () {
          // Track retry_popup_click event
          self._trackStoryEvent('retry_popup_click', {
            error_type: isContentErrorOnly ? 'content_error' : 'network_error',
            retry_attempt: self.errorCount + 1
          });

          // Track retry_popup_hidden event
          self._trackStoryEvent('retry_popup_hidden', {
            action: 'retry_clicked'
          });

          window.PopupComponent.hide();
          setTimeout(function () {
            self.retryLoadMedia();
          }, 250);
        }
      });
    }

    /**
     * Retry loading media after error
     */
    async retryLoadMedia() {
      console.log('[StoriesComponent] Retrying media load...', this.errorCount);

      // Set retry flag to prevent popup during retry
      this.isRetrying = true;

      // Track retry_popup_hidden if popup was showing (for auto-recovery case)
      if (this.errorPopupShowing) {
        this._trackStoryEvent('retry_popup_hidden', {
          action: 'auto_recovery'
        });
      }

      console.log(`[StoriesComponent] retryLoadMedia called. Current errorCount: ${this.errorCount}, maxRetries: ${this.maxRetries}, story: ${this.currentIndex}`);

      // Check if max retries exceeded BEFORE incrementing
      if (this.errorCount >= this.maxRetries) {
        console.warn(
          `[StoriesComponent] Max retries (${this.maxRetries}) exceeded for story ${this.currentIndex}, skipping to next`
        );

        // Track max retries exceeded event
        this._trackStoryEvent('retry_max_exceeded', {
          max_retries: this.maxRetries,
          story_index: this.currentIndex,
          retry_attempts: this.errorCount,
          failed_urls: this.failedMediaUrls.map(item => item.url)
        });

        // Reset error state
        this.errorPopupShowing = false;
        this.isContentError = false;
        this.isNetworkOffline = false;
        this.failedMediaUrls = [];
        this.errorCount = 0;
        this.retryingStoryIndex = null;
        this.isRetrying = false; // Clear retry flag

        // Skip to next story
        const nextIndex = this.currentIndex + 1;
        if (nextIndex < this.stories.length) {
          console.log('[StoriesComponent] Moving to next story:', nextIndex);
          await this.next({}, false); // false = not manual skip
        } else {
          console.log('[StoriesComponent] No more stories, completing');
          this.complete();
        }
        return;
      }

      // Increment error count after checking
      this.errorCount++;
      console.log(`[StoriesComponent] Incremented errorCount to: ${this.errorCount}`);

      // Reset error state
      this.errorPopupShowing = false;
      this.isContentError = false;
      this.isNetworkOffline = false;
      const failedUrls = [...this.failedMediaUrls];
      this.failedMediaUrls = [];

      // Log retry attempt
      console.log(`[StoriesComponent] Retry attempt ${this.errorCount}/${this.maxRetries}, failed URLs:`, failedUrls);

      // Reload current story
      try {
        console.log(`[StoriesComponent] Calling showStory for retry. Story: ${this.currentIndex}, errorCount: ${this.errorCount}/${this.maxRetries}`);
        await this.showStory(this.currentIndex, 'retry');

        console.log(`[StoriesComponent] showStory completed. Checking for errors...`);

        // Clear retry flag
        this.isRetrying = false;

        // Check if errors occurred during retry
        // If errors occurred, handleMediaLoadError would have been called
        if (this.isContentError || this.failedMediaUrls.length > 0) {
          console.log('[StoriesComponent] Errors still present after retry:', {
            isContentError: this.isContentError,
            failedUrlsCount: this.failedMediaUrls.length,
            errorCount: this.errorCount
          });
          // Errors still exist - show popup now that retry is complete
          this.showMediaErrorPopup();
        } else {
          console.log('[StoriesComponent] Retry successful! No errors detected.');
          // Success - errorCount will be reset when user navigates to next/prev story
        }
      } catch (error) {
        console.error('[StoriesComponent] Retry failed with exception:', error);
        // Clear retry flag on error
        this.isRetrying = false;
      }
    }

    /**
     * Pause all media (video and audio)
     */
    pauseAllMedia() {
      // Pause background video
      const bgVideo = this.container.querySelector('.story-background-video');
      if (bgVideo && !bgVideo.paused) {
        try {
          bgVideo.pause();
        } catch (error) {
          console.warn('[StoriesComponent] Error pausing background video:', error);
        }
      }

      // Pause avatar videos
      const avatarVideos = this.container.querySelectorAll('video[data-element-type="avatar"]');
      avatarVideos.forEach(video => {
        if (!video.paused) {
          try {
            video.pause();
          } catch (error) {
            console.warn('[StoriesComponent] Error pausing avatar video:', error);
          }
        }
      });

      // Pause background audio
      const audio = document.getElementById('commonSoundComponent');
      if (audio && !audio.paused) {
        try {
          audio.pause();
        } catch (error) {
          console.warn('[StoriesComponent] Error pausing background audio:', error);
        }
      }

      // Pause story audio (via audioManager)
      if (this.audioManager && this.currentAudioId) {
        try {
          this.audioManager.pause();
        } catch (error) {
          console.warn('[StoriesComponent] Error pausing story audio:', error);
        }
      }
    }

    /**
     * Resume all media (video and audio)
     */
    resumeAllMedia() {
      // Resume background video
      const bgVideo = this.container.querySelector('.story-background-video');
      if (bgVideo && bgVideo.paused) {
        const hasEnded = bgVideo.duration > 0 && bgVideo.currentTime >= bgVideo.duration;
        if (!hasEnded) {
          try {
            bgVideo.play().catch(error => {
              console.warn('[StoriesComponent] Error resuming background video:', error);
            });
          } catch (error) {
            console.warn('[StoriesComponent] Error resuming background video:', error);
          }
        }
      }

      // Resume avatar videos
      const avatarVideos = this.container.querySelectorAll('video[data-element-type="avatar"]');
      avatarVideos.forEach(video => {
        if (video.paused) {
          const hasEnded = video.duration > 0 && video.currentTime >= video.duration;
          if (!hasEnded) {
            try {
              video.play().catch(error => {
                console.warn('[StoriesComponent] Error resuming avatar video:', error);
              });
            } catch (error) {
              console.warn('[StoriesComponent] Error resuming avatar video:', error);
            }
          }
        }
      });

      // Resume background audio
      const audio = document.getElementById('commonSoundComponent');
      if (audio && audio.paused && audio.src) {
        const hasEnded = audio.duration > 0 && audio.currentTime >= audio.duration;
        if (!hasEnded) {
          try {
            audio.play().catch(error => {
              console.warn('[StoriesComponent] Error resuming background audio:', error);
            });
          } catch (error) {
            console.warn('[StoriesComponent] Error resuming background audio:', error);
          }
        }
      }

      // Resume story audio (via audioManager)
      if (this.audioManager && this.currentAudioId) {
        try {
          this.audioManager.resume();
        } catch (error) {
          console.warn('[StoriesComponent] Error resuming story audio:', error);
        }
      }
    }

    /**
     * Preload assets for next and previous stories
     * Improves navigation performance by preloading media
     */
    preloadAdjacentStories() {
      const prevIndex = this.currentIndex - 1;
      const nextIndex = this.currentIndex + 1;

      // Preload previous story
      if (prevIndex >= 0 && prevIndex < this.stories.length) {
        this.preloadStoryAssets(this.stories[prevIndex]);
      }

      // Preload next story
      if (nextIndex >= 0 && nextIndex < this.stories.length) {
        this.preloadStoryAssets(this.stories[nextIndex]);
      }
    }

    /**
     * Preload assets for a specific story
     * @param {Object} story - Story data
     */
    preloadStoryAssets(story) {
      if (!story) return;

      try {
        // Apply global variable replacement to get actual URLs
        const replacedStory = this.utils.replaceGlobalVariables(story, this.globalContext.value_map);

        // Preload background video
        if (replacedStory.background?.type === 'VIDEO' && replacedStory.background?.value) {
          const videoUrl = replacedStory.background.value;
          const video = document.createElement('video');
          video.preload = 'auto';
          video.src = videoUrl;
          console.log('[StoriesComponent] Preloading video:', videoUrl);
        }

        // Preload background image
        if (replacedStory.background?.type === 'IMAGE' && replacedStory.background?.value) {
          const imageUrl = replacedStory.background.value;
          const img = new Image();
          img.src = imageUrl;
          console.log('[StoriesComponent] Preloading image:', imageUrl);
        }

        // Preload background audio
        if (replacedStory.backgroundAudio) {
          const audioUrl = replacedStory.backgroundAudio;
          const audio = new Audio();
          audio.preload = 'auto';
          audio.src = audioUrl;

          // Track audio load errors
          audio.addEventListener('error', e => {
            console.error('[StoriesComponent] Background audio preload error:', audioUrl);
            this.handleMediaLoadError('audio', audioUrl, e);
          });

          console.log('[StoriesComponent] Preloading audio:', audioUrl);
        }

        // Preload layer images
        if (replacedStory.layers && Array.isArray(replacedStory.layers)) {
          replacedStory.layers.forEach(layer => {
            if (layer.type === 'IMAGE' && layer.value) {
              const img = new Image();
              img.src = layer.value;
              console.log('[StoriesComponent] Preloading layer image:', layer.value);
            }
          });
        }
      } catch (error) {
        console.warn('[StoriesComponent] Error preloading story assets:', error);
      }
    }

    /**
     * Complete all stories
     */
    complete() {
      try {
        console.log('[StoriesComponent] Stories complete');

        // Track final story duration
        if (this.durationData.currentStoryStartTime && this.config.trackDuration) {
          const duration =
            (Date.now() - this.durationData.currentStoryStartTime) / 1000 - this.durationData.currentStoryInactiveDuration;

          this.durationData.perStory[this.currentIndex] = (this.durationData.perStory[this.currentIndex] || 0) + duration;
        }

        // Calculate total duration
        if (this.config.trackDuration && this.durationData.startTime) {
          this.durationData.total = (Date.now() - this.durationData.startTime) / 1000 - this.durationData.inactive;
        }

        // Stop audio
        this.stopCurrentAudio();

        // Trigger callback
        if (typeof this.config.onComplete === 'function') {
          try {
            this.config.onComplete({
              history: this.history,
              inputs: this.inputs,
              globalContext: this.globalContext,
              durations: this.getAllDurationData()
            });
          } catch (error) {
            console.error('[StoriesComponent] onComplete callback error:', error);
          }
        }
      } catch (error) {
        this.handleError(error);
      }
    }

    /**
     * Get all duration data
     * @returns {Object} Duration data
     */
    getAllDurationData() {
      return {
        perStory: { ...this.durationData.perStory },
        total: this.durationData.total,
        inactive: this.durationData.inactive,
        active: this.durationData.total - this.durationData.inactive
      };
    }

    /**
     * Get current story
     * @returns {Object} Current story data
     */
    getCurrentStory() {
      return this.stories[this.currentIndex];
    }

    /**
     * Get current story index
     * @returns {number} Current index
     */
    getCurrentIndex() {
      return this.currentIndex;
    }

    /**
     * Pause component
     */
    pause() {
      this.isPaused = true;
      this.handleTabHidden();
    }

    /**
     * Resume component
     */
    resume() {
      this.isPaused = false;
      this.handleTabVisible();
    }

    /**
     * Reset component to initial state
     */
    reset() {
      try {
        // Stop audio
        this.stopCurrentAudio();

        // Reset state
        this.currentIndex = 0;
        this.history = [];
        this.inputs = {};
        this.globalContext.value_map = {
          ...(this.config.globalContext?.value_map || {})
        };

        // Reset duration tracking
        if (this.config.trackDuration) {
          this.durationData = {
            perStory: {},
            total: 0,
            inactive: 0,
            startTime: Date.now(),
            currentStoryStartTime: null,
            currentStoryInactiveDuration: 0,
            tabHiddenTime: null
          };
        }

        // Re-render and show first story
        this.render();
        this.showStory(0, 'initial');

        console.log('[StoriesComponent] Component reset');
      } catch (error) {
        this.handleError(error);
      }
    }

    /**
     * Destroy component and clean up
     */
    destroy() {
      try {
        // Track story_cleanup_video if current story has video
        const currentStory = this.stories[this.currentIndex];
        const hasVideo = currentStory?.data?.v2_story?.background?.type === 'VIDEO';
        if (hasVideo) {
          this._trackStoryEvent('story_cleanup_video');
        }

        // Stop audio
        this.stopCurrentAudio();

        // Clear progress tracking interval
        if (this.progressInterval) {
          clearInterval(this.progressInterval);
          this.progressInterval = null;
        }

        // Remove event listeners
        if (this.visibilityTracker) {
          this.visibilityTracker.stop();
          this.visibilityTracker = null;
        } else if (this.visibilityHandler) {
          document.removeEventListener('visibilitychange', this.visibilityHandler);
          this.visibilityHandler = null;
        }

        if (this.resizeHandler) {
          window.removeEventListener('resize', this.resizeHandler);
          window.removeEventListener('orientationchange', this.resizeHandler);
          this.resizeHandler = null;
        }

        // Reset container styles (remove fullscreen)
        if (this.container) {
          this.container.style.position = '';
          this.container.style.top = '';
          this.container.style.left = '';
          this.container.style.transform = '';
          this.container.style.width = '';
          this.container.style.maxWidth = '';
          this.container.style.height = '';
          this.container.style.zIndex = '';
          this.container.style.overflow = '';
          this.container.innerHTML = '';
        }

        // Clear state
        this.stories = [];
        this.storiesMap = {}; // Changed from Map to object
        this.history = [];
        this.inputs = {};
        this.assetDurations = {};
        this.durationData = {};

        console.log('[StoriesComponent] Component destroyed');
      } catch (error) {
        console.error('[StoriesComponent] Error destroying component:', error);
      }
    }

    /**
     * Handle errors
     * @param {Error} error - Error object
     */
    handleError(error) {
      console.error('[StoriesComponent] Error:', error);

      // Trigger error callback
      if (typeof this.config.onError === 'function') {
        try {
          this.config.onError(error);
        } catch (callbackError) {
          console.error('[StoriesComponent] onError callback error:', callbackError);
        }
      }

      // Show error in UI (optional)
      const storyContent = this.container.querySelector('.story-content');
      if (storyContent) {
        storyContent.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 40px;
            text-align: center;
          ">
            <div style="
              font-size: 48px;
              margin-bottom: 16px;
            ">⚠️</div>
            <div style="
              font-size: 20px;
              font-weight: 600;
              color: #333;
              margin-bottom: 8px;
            ">Something went wrong</div>
            <div style="
              font-size: 14px;
              color: #666;
              max-width: 400px;
            ">${error.message || 'An unexpected error occurred'}</div>
          </div>
        `;
      }
    }
  }

  // Export globally
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StoriesComponent;
  } else {
    window.StoriesComponent = StoriesComponent;
  }

  console.log('[StoriesComponent] v2.0.0 loaded');
})(typeof window !== 'undefined' ? window : this);
