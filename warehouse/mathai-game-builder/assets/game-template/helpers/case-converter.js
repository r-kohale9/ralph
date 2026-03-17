/**
 * Case Converter Helper
 *
 * Provides utilities to convert between camelCase and snake_case.
 * Backend expects snake_case for database schema.
 */

/**
 * Convert camelCase to snake_case recursively
 * @param {any} obj - Object to convert
 * @returns {any} - Converted object
 *
 * @example
 * toSnakeCase({ userName: 'John', userId: 123 })
 * // Returns: { user_name: 'John', user_id: 123 }
 */
function toSnakeCase(obj) {
  // Handle null, undefined, primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays recursively
  if (Array.isArray(obj)) {
    return obj.map(item => toSnakeCase(item));
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }

  // Handle plain objects
  return Object.keys(obj).reduce((acc, key) => {
    // Convert key from camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

    // Recursively convert value
    acc[snakeKey] = toSnakeCase(obj[key]);

    return acc;
  }, {});
}

/**
 * Convert snake_case to camelCase recursively
 * @param {any} obj - Object to convert
 * @returns {any} - Converted object
 *
 * @example
 * toCamelCase({ user_name: 'John', user_id: 123 })
 * // Returns: { userName: 'John', userId: 123 }
 */
function toCamelCase(obj) {
  // Handle null, undefined, primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays recursively
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }

  // Handle plain objects
  return Object.keys(obj).reduce((acc, key) => {
    // Convert key from snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // Recursively convert value
    acc[camelKey] = toCamelCase(obj[key]);

    return acc;
  }, {});
}

/**
 * Log object transformation (useful for debugging)
 * @param {string} label - Label for the log
 * @param {any} before - Object before conversion
 * @param {any} after - Object after conversion
 */
function logTransformation(label, before, after) {
  console.log(`🔄 ${label}`);
  console.log('Before:', JSON.stringify(before, null, 2));
  console.log('After:', JSON.stringify(after, null, 2));
}

// Export for use in games
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toSnakeCase, toCamelCase, logTransformation };
}
