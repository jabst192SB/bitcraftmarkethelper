/**
 * Saved Searches Module for Bitcraft Market Helper
 * Handles localStorage operations with best practices:
 * - Namespaced keys
 * - Error handling
 * - Size limits
 * - Data validation
 * - Cross-page synchronization
 */

const SavedSearches = (() => {
    // Configuration
    const STORAGE_KEY = 'bitcraftMarketHelper_savedSearches';
    const STORAGE_VERSION = 1;
    const MAX_SEARCHES = 20;
    const MAX_NAME_LENGTH = 50;

    // Generate unique ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Generate helpful default names
    function generateSearchName(config, type) {
        if (type === 'gear-finder') {
            const parts = [];
            if (config.tiers?.length > 0) {
                parts.push(`Tier ${config.tiers.join(',')}`);
            }
            if (config.categories?.length > 0) {
                const catName = config.categories[0];
                parts.push(catName);
            }
            if (config.rarities?.length > 0) {
                parts.push(config.rarities[0]);
            }
            return parts.join(' - ') || 'Untitled Search';
        } else if (type === 'single-item') {
            const term = config.searchTerm || '';
            const tier = config.tier && config.tier !== 'all' ? ` (Tier ${config.tier})` : '';
            return (term + tier) || 'Untitled Search';
        }
        return 'Untitled Search';
    }

    // Validate search object
    function validateSearch(search) {
        return search &&
               search.id &&
               search.name &&
               search.type &&
               search.config &&
               ['single-item', 'gear-finder'].includes(search.type) &&
               typeof search.timestamp === 'number';
    }

    // Load data with migration support
    function loadData() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) {
                return {
                    version: STORAGE_VERSION,
                    searches: []
                };
            }

            const parsed = JSON.parse(data);

            // Migrate from old format (array) to new format (object with version)
            if (Array.isArray(parsed)) {
                return {
                    version: STORAGE_VERSION,
                    searches: parsed.filter(validateSearch)
                };
            }

            // Validate version and searches
            if (!parsed.version) {
                parsed.version = STORAGE_VERSION;
            }
            if (!Array.isArray(parsed.searches)) {
                parsed.searches = [];
            }

            // Filter out invalid searches
            parsed.searches = parsed.searches.filter(validateSearch);

            return parsed;
        } catch (e) {
            console.error('Failed to load saved searches:', e);
            return {
                version: STORAGE_VERSION,
                searches: []
            };
        }
    }

    // Save data with error handling
    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return { success: true };
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                // Auto-cleanup: remove oldest searches
                console.warn('Storage quota exceeded, pruning old searches...');
                data.searches = data.searches
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, Math.floor(MAX_SEARCHES / 2));

                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    return {
                        success: true,
                        warning: 'Storage limit reached. Oldest searches were removed.'
                    };
                } catch (e2) {
                    return {
                        success: false,
                        error: 'Failed to save: storage quota exceeded'
                    };
                }
            }
            return {
                success: false,
                error: 'Failed to save search: ' + e.message
            };
        }
    }

    // Public API
    return {
        /**
         * Get all saved searches
         * @param {string} type - Optional filter by type ('single-item' or 'gear-finder')
         * @returns {Array} Array of saved searches
         */
        getAll(type = null) {
            const data = loadData();
            if (type) {
                return data.searches.filter(s => s.type === type);
            }
            return data.searches;
        },

        /**
         * Get a single saved search by ID
         * @param {string} id - Search ID
         * @returns {Object|null} Search object or null if not found
         */
        getById(id) {
            const data = loadData();
            return data.searches.find(s => s.id === id) || null;
        },

        /**
         * Save a new search
         * @param {Object} config - Search configuration
         * @param {string} type - Search type ('single-item' or 'gear-finder')
         * @param {string} name - Optional custom name
         * @returns {Object} Result with success status and search object
         */
        save(config, type, name = null) {
            const data = loadData();

            // Validate inputs
            if (!config || !type || !['single-item', 'gear-finder'].includes(type)) {
                return {
                    success: false,
                    error: 'Invalid search configuration or type'
                };
            }

            // Check for duplicates
            const duplicate = data.searches.find(s =>
                s.type === type &&
                JSON.stringify(s.config) === JSON.stringify(config)
            );

            if (duplicate) {
                return {
                    success: false,
                    error: 'This search is already saved',
                    duplicate: duplicate
                };
            }

            // Generate name if not provided
            const searchName = name || generateSearchName(config, type);

            // Trim name to max length
            const trimmedName = searchName.substring(0, MAX_NAME_LENGTH);

            // Create search object
            const search = {
                id: generateId(),
                name: trimmedName,
                type: type,
                timestamp: Date.now(),
                config: config
            };

            // Add to searches
            data.searches.push(search);

            // Enforce max limit (remove oldest)
            if (data.searches.length > MAX_SEARCHES) {
                data.searches.sort((a, b) => a.timestamp - b.timestamp);
                data.searches = data.searches.slice(-MAX_SEARCHES);
            }

            // Save to localStorage
            const result = saveData(data);

            if (result.success) {
                return {
                    success: true,
                    search: search,
                    warning: result.warning
                };
            } else {
                return result;
            }
        },

        /**
         * Update an existing search
         * @param {string} id - Search ID
         * @param {Object} updates - Object with fields to update (name, config)
         * @returns {Object} Result with success status
         */
        update(id, updates) {
            const data = loadData();
            const index = data.searches.findIndex(s => s.id === id);

            if (index === -1) {
                return {
                    success: false,
                    error: 'Search not found'
                };
            }

            // Update allowed fields
            if (updates.name !== undefined) {
                data.searches[index].name = updates.name.substring(0, MAX_NAME_LENGTH);
            }
            if (updates.config !== undefined) {
                data.searches[index].config = updates.config;
            }

            // Update timestamp
            data.searches[index].timestamp = Date.now();

            const result = saveData(data);
            return result;
        },

        /**
         * Delete a saved search
         * @param {string} id - Search ID
         * @returns {Object} Result with success status
         */
        delete(id) {
            const data = loadData();
            const index = data.searches.findIndex(s => s.id === id);

            if (index === -1) {
                return {
                    success: false,
                    error: 'Search not found'
                };
            }

            data.searches.splice(index, 1);
            const result = saveData(data);
            return result;
        },

        /**
         * Clear all saved searches
         * @returns {Object} Result with success status
         */
        clear() {
            const data = {
                version: STORAGE_VERSION,
                searches: []
            };
            return saveData(data);
        },

        /**
         * Export searches as JSON
         * @returns {string} JSON string of all searches
         */
        exportToJSON() {
            const data = loadData();
            return JSON.stringify(data.searches, null, 2);
        },

        /**
         * Import searches from JSON
         * @param {string} jsonString - JSON string of searches to import
         * @param {boolean} merge - If true, merge with existing; if false, replace
         * @returns {Object} Result with success status
         */
        importFromJSON(jsonString, merge = true) {
            try {
                const imported = JSON.parse(jsonString);

                if (!Array.isArray(imported)) {
                    return {
                        success: false,
                        error: 'Invalid format: expected an array of searches'
                    };
                }

                // Validate all imported searches
                const validSearches = imported.filter(validateSearch);

                if (validSearches.length === 0) {
                    return {
                        success: false,
                        error: 'No valid searches found in import data'
                    };
                }

                const data = loadData();

                if (merge) {
                    // Merge with existing searches (avoid duplicates by config)
                    const existingConfigs = new Set(
                        data.searches.map(s => JSON.stringify({ type: s.type, config: s.config }))
                    );

                    const newSearches = validSearches.filter(s =>
                        !existingConfigs.has(JSON.stringify({ type: s.type, config: s.config }))
                    );

                    data.searches.push(...newSearches);

                    // Enforce max limit
                    if (data.searches.length > MAX_SEARCHES) {
                        data.searches.sort((a, b) => b.timestamp - a.timestamp);
                        data.searches = data.searches.slice(0, MAX_SEARCHES);
                    }
                } else {
                    // Replace all searches
                    data.searches = validSearches.slice(0, MAX_SEARCHES);
                }

                const result = saveData(data);

                if (result.success) {
                    return {
                        success: true,
                        imported: validSearches.length,
                        total: data.searches.length,
                        warning: result.warning
                    };
                } else {
                    return result;
                }
            } catch (e) {
                return {
                    success: false,
                    error: 'Failed to parse import data: ' + e.message
                };
            }
        },

        /**
         * Check if a search configuration is already saved
         * @param {Object} config - Search configuration
         * @param {string} type - Search type
         * @returns {Object|null} Matching saved search or null
         */
        findDuplicate(config, type) {
            const data = loadData();
            return data.searches.find(s =>
                s.type === type &&
                JSON.stringify(s.config) === JSON.stringify(config)
            ) || null;
        },

        /**
         * Listen for changes from other tabs/windows
         * @param {Function} callback - Function to call when searches change
         * @returns {Function} Cleanup function to remove listener
         */
        onStorageChange(callback) {
            const handler = (e) => {
                if (e.key === STORAGE_KEY) {
                    callback();
                }
            };
            window.addEventListener('storage', handler);

            // Return cleanup function
            return () => window.removeEventListener('storage', handler);
        }
    };
})();
