/**
 * Bitcraft Market Helper - Browser Configuration
 *
 * Configuration for HTML files and browser-based scripts.
 * Loaded via <script src="config-browser.js"></script>
 */
const BitcraftConfig = {
  // API Endpoints
  API_BASE_URL: 'https://bitcraft-market-proxy.jbaird-cb6.workers.dev',
  BITJITA_URL: 'https://bitjita.com',

  // Region Settings
  DEFAULT_REGION_ID: 4, // Solvenar
  REGIONS: {
    SOLVENAR: 4,
    // Add other regions as needed
  },

  // Cache Settings
  CACHE: {
    ITEMS_KEY: 'bitcraftMarketHelper_itemsCache',
    ITEMS_VERSION: 'v1',
    ITEMS_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
    ORDERS_KEY_PREFIX: 'bmh_order_',
    ORDERS_TTL_MS: 15 * 60 * 1000, // 15 minutes
    BULK_PRICES_KEY_PREFIX: 'bmh_bulk_',
    BULK_PRICES_TTL_MS: 15 * 60 * 1000, // 15 minutes
  },

  // UI Settings
  UI: {
    VERSION_KEY: 'bitcraftMarketHelper_uiVersion',
    TOAST_DURATION: 3000,
    DEBOUNCE_DELAY: 300,
  },

  // Feature Flags
  FEATURES: {
    ENABLE_CACHING: true,
    CACHE_DEBUG: false, // Set to true for cache hit/miss logging
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.BitcraftConfig = BitcraftConfig;
}
