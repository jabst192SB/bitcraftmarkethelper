/**
 * Favorites Module for Bitcraft Market Helper
 * Handles localStorage operations for favorite items
 * - Persistent storage
 * - Quick access to favorite items
 * - Cross-page synchronization
 */

const Favorites = (() => {
    // Configuration
    const STORAGE_KEY = 'bitcraftMarketHelper_favorites';
    const STORAGE_VERSION = 1;
    const MAX_FAVORITES = 50;

    // Generate unique ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Validate favorite object
    function validateFavorite(fav) {
        return fav &&
               fav.id &&
               fav.itemId &&
               fav.itemName &&
               typeof fav.timestamp === 'number';
    }

    // Load data with migration support
    function loadData() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) {
                return {
                    version: STORAGE_VERSION,
                    favorites: []
                };
            }

            const parsed = JSON.parse(data);

            // Migrate from old format (array) to new format (object with version)
            if (Array.isArray(parsed)) {
                return {
                    version: STORAGE_VERSION,
                    favorites: parsed.filter(validateFavorite)
                };
            }

            // Validate version and favorites
            if (!parsed.version) {
                parsed.version = STORAGE_VERSION;
            }
            if (!Array.isArray(parsed.favorites)) {
                parsed.favorites = [];
            }

            // Filter out invalid favorites
            parsed.favorites = parsed.favorites.filter(validateFavorite);

            return parsed;
        } catch (e) {
            console.error('Failed to load favorites:', e);
            return {
                version: STORAGE_VERSION,
                favorites: []
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
                // Auto-cleanup: remove oldest favorites
                console.warn('Storage quota exceeded, pruning old favorites...');
                data.favorites = data.favorites
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, Math.floor(MAX_FAVORITES / 2));

                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    return {
                        success: true,
                        warning: 'Storage limit reached. Oldest favorites were removed.'
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
                error: 'Failed to save favorite: ' + e.message
            };
        }
    }

    // Public API
    return {
        /**
         * Get all favorites
         * @param {string} sortBy - Optional sort key ('timestamp', 'itemName')
         * @returns {Array} Array of favorites
         */
        getAll(sortBy = 'timestamp') {
            const data = loadData();
            const favorites = data.favorites;

            if (sortBy === 'itemName') {
                return favorites.sort((a, b) => a.itemName.localeCompare(b.itemName));
            } else {
                return favorites.sort((a, b) => b.timestamp - a.timestamp);
            }
        },

        /**
         * Get a favorite by item ID
         * @param {string} itemId - Item ID
         * @returns {Object|null} Favorite object or null if not found
         */
        getByItemId(itemId) {
            const data = loadData();
            return data.favorites.find(f => f.itemId === itemId) || null;
        },

        /**
         * Check if an item is favorited
         * @param {string} itemId - Item ID
         * @returns {boolean} True if favorited
         */
        isFavorited(itemId) {
            const data = loadData();
            return data.favorites.some(f => f.itemId === itemId);
        },

        /**
         * Add a favorite
         * @param {string} itemId - Item ID
         * @param {string} itemName - Item name
         * @param {Object} metadata - Optional metadata (tier, rarity, etc.)
         * @returns {Object} Result with success status
         */
        add(itemId, itemName, metadata = {}) {
            const data = loadData();

            // Check if already favorited
            if (data.favorites.some(f => f.itemId === itemId)) {
                return {
                    success: false,
                    error: 'Item is already in favorites'
                };
            }

            // Create favorite object
            const favorite = {
                id: generateId(),
                itemId: itemId,
                itemName: itemName,
                timestamp: Date.now(),
                ...metadata
            };

            // Add to favorites
            data.favorites.push(favorite);

            // Enforce max limit (remove oldest)
            if (data.favorites.length > MAX_FAVORITES) {
                data.favorites.sort((a, b) => a.timestamp - b.timestamp);
                data.favorites = data.favorites.slice(-MAX_FAVORITES);
            }

            // Save to localStorage
            const result = saveData(data);

            if (result.success) {
                return {
                    success: true,
                    favorite: favorite,
                    warning: result.warning
                };
            } else {
                return result;
            }
        },

        /**
         * Remove a favorite by item ID
         * @param {string} itemId - Item ID
         * @returns {Object} Result with success status
         */
        remove(itemId) {
            const data = loadData();
            const index = data.favorites.findIndex(f => f.itemId === itemId);

            if (index === -1) {
                return {
                    success: false,
                    error: 'Favorite not found'
                };
            }

            data.favorites.splice(index, 1);
            const result = saveData(data);
            return result;
        },

        /**
         * Toggle favorite status
         * @param {string} itemId - Item ID
         * @param {string} itemName - Item name
         * @param {Object} metadata - Optional metadata
         * @returns {Object} Result with success status and new state
         */
        toggle(itemId, itemName, metadata = {}) {
            if (this.isFavorited(itemId)) {
                const result = this.remove(itemId);
                return {
                    ...result,
                    isFavorited: false
                };
            } else {
                const result = this.add(itemId, itemName, metadata);
                return {
                    ...result,
                    isFavorited: true
                };
            }
        },

        /**
         * Clear all favorites
         * @returns {Object} Result with success status
         */
        clear() {
            const data = {
                version: STORAGE_VERSION,
                favorites: []
            };
            return saveData(data);
        },

        /**
         * Get favorite count
         * @returns {number} Number of favorites
         */
        count() {
            const data = loadData();
            return data.favorites.length;
        },

        /**
         * Export favorites as JSON
         * @returns {string} JSON string of all favorites
         */
        exportToJSON() {
            const data = loadData();
            return JSON.stringify(data.favorites, null, 2);
        },

        /**
         * Import favorites from JSON
         * @param {string} jsonString - JSON string of favorites to import
         * @param {boolean} merge - If true, merge with existing; if false, replace
         * @returns {Object} Result with success status
         */
        importFromJSON(jsonString, merge = true) {
            try {
                const imported = JSON.parse(jsonString);

                if (!Array.isArray(imported)) {
                    return {
                        success: false,
                        error: 'Invalid format: expected an array of favorites'
                    };
                }

                // Validate all imported favorites
                const validFavorites = imported.filter(validateFavorite);

                if (validFavorites.length === 0) {
                    return {
                        success: false,
                        error: 'No valid favorites found in import data'
                    };
                }

                const data = loadData();

                if (merge) {
                    // Merge with existing favorites (avoid duplicates by itemId)
                    const existingIds = new Set(data.favorites.map(f => f.itemId));
                    const newFavorites = validFavorites.filter(f => !existingIds.has(f.itemId));
                    data.favorites.push(...newFavorites);

                    // Enforce max limit
                    if (data.favorites.length > MAX_FAVORITES) {
                        data.favorites.sort((a, b) => b.timestamp - a.timestamp);
                        data.favorites = data.favorites.slice(0, MAX_FAVORITES);
                    }
                } else {
                    // Replace all favorites
                    data.favorites = validFavorites.slice(0, MAX_FAVORITES);
                }

                const result = saveData(data);

                if (result.success) {
                    return {
                        success: true,
                        imported: validFavorites.length,
                        total: data.favorites.length,
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
         * Listen for changes from other tabs/windows
         * @param {Function} callback - Function to call when favorites change
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

// Make available globally
if (typeof window !== 'undefined') {
    window.Favorites = Favorites;
}
