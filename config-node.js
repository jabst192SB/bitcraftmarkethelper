/**
 * Bitcraft Market Helper - Node.js Configuration
 *
 * Configuration for local-monitor.js, fetch-all-items.js, sync-to-worker.js
 * and other Node.js scripts.
 */

module.exports = {
  // External APIs
  TARGET_API: 'https://bitjita.com',
  WORKER_URL: 'https://bitcraft-market-proxy.jbaird-cb6.workers.dev',

  // Region Settings
  MONITOR_REGION_ID: 4, // Solvenar

  // Rate Limiting (Aggressive for local dev)
  RATE_LIMIT: {
    DELAY_BETWEEN_REQUESTS_MS: 50,
    DELAY_BETWEEN_BATCHES_MS: 500,
    BATCH_SIZE: 10,
    RETRY_ATTEMPTS: 3,
  },

  // Bulk Update Settings
  BULK_UPDATE: {
    MAX_DETAILS_FETCH: 100,
    MAX_ITEMS_PER_BATCH: 100, // Bulk API limit
    BULK_BATCH_DELAY_MS: 200,
  },

  // Supabase Sync
  SUPABASE_SYNC: {
    BATCH_SIZE: 100,
    DELAY_BETWEEN_BATCHES_MS: 100,
  },

  // Monitoring
  MONITOR: {
    DEFAULT_INTERVAL_SECONDS: 120,
    WATCH_INTERVAL_SECONDS: 60,
    CLEANUP_AGE_HOURS: 8,
    CHANGE_HISTORY_LIMIT: 1000,
  },

  // File Paths
  STATE_FILE: 'local-monitor-state.json',
};
