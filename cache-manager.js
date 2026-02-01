/**
 * Bitcraft Market Helper - Cache Manager
 *
 * Browser-side localStorage cache with TTL support for API responses.
 * Provides automatic cache expiration, quota management, and statistics.
 */
const CacheManager = (() => {
  const CACHE_VERSION = 'v1';

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached data or null if expired/missing
   */
  function get(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const entry = JSON.parse(cached);

      // Version check
      if (entry.version !== CACHE_VERSION) {
        localStorage.removeItem(key);
        return null;
      }

      // TTL check
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      // Cache hit
      if (window.BitcraftConfig?.FEATURES?.CACHE_DEBUG) {
        console.log(`[Cache HIT] ${key} (age: ${Math.round(age / 1000)}s)`);
      }
      return entry.data;
    } catch (error) {
      console.warn('Cache read error:', error);
      return null;
    }
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  function set(key, data, ttl) {
    try {
      const entry = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        ttl: ttl,
        data: data
      };
      localStorage.setItem(key, JSON.stringify(entry));

      if (window.BitcraftConfig?.FEATURES?.CACHE_DEBUG) {
        const size = new Blob([JSON.stringify(entry)]).size;
        console.log(`[Cache SET] ${key} (size: ${size} bytes, ttl: ${ttl / 1000}s)`);
      }
    } catch (error) {
      // Quota exceeded - clear old entries
      if (error.name === 'QuotaExceededError') {
        console.warn('Cache quota exceeded, clearing old entries...');
        clearOldEntries();
        // Retry once
        try {
          localStorage.setItem(key, JSON.stringify(entry));
        } catch (retryError) {
          console.error('Cache set failed after cleanup:', retryError);
        }
      } else {
        console.warn('Cache write error:', error);
      }
    }
  }

  /**
   * Remove item from cache
   * @param {string} key - Cache key
   */
  function remove(key) {
    localStorage.removeItem(key);
  }

  /**
   * Clear all cache entries matching prefix
   * @param {string} prefix - Key prefix to match
   */
  function clearByPrefix(prefix) {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Clear expired entries to free up space
   */
  function clearOldEntries() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('bmh_')) {
        try {
          const entry = JSON.parse(localStorage.getItem(key));
          const age = Date.now() - entry.timestamp;
          if (age > entry.ttl) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Invalid entry, remove it
          localStorage.removeItem(key);
        }
      }
    });
  }

  /**
   * Get cache statistics
   * @returns {Object} - Stats object
   */
  function getStats() {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith('bmh_'));
    let totalSize = 0;
    let validEntries = 0;
    let expiredEntries = 0;

    cacheKeys.forEach(key => {
      try {
        const item = localStorage.getItem(key);
        totalSize += new Blob([item]).size;

        const entry = JSON.parse(item);
        const age = Date.now() - entry.timestamp;
        if (age > entry.ttl) {
          expiredEntries++;
        } else {
          validEntries++;
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    return {
      totalEntries: cacheKeys.length,
      validEntries,
      expiredEntries,
      totalSize,
      totalSizeKB: Math.round(totalSize / 1024)
    };
  }

  return {
    get,
    set,
    remove,
    clearByPrefix,
    clearOldEntries,
    getStats
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.CacheManager = CacheManager;
}
