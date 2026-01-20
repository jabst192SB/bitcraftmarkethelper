/**
 * Bitcraft Market Helper - Shared Utilities
 *
 * This module contains common JavaScript utilities used across all pages.
 * Import this file in your HTML pages to use these functions.
 *
 * Usage in HTML:
 *   <script src="shared-utils.js"></script>
 *   <script>
 *     BitcraftUtils.showToast('Hello!', 'success');
 *   </script>
 */

const BitcraftUtils = (() => {
    // ============================================
    // CONFIGURATION
    // ============================================

    const CONFIG = {
        API_BASE_URL: 'https://bitcraft-market-proxy.jbaird-cb6.workers.dev',
        BITJITA_URL: 'https://bitjita.com',
        DEFAULT_REGION_ID: 4, // Solvenar
        TOAST_DURATION: 3000,
        DEBOUNCE_DELAY: 300,
        ITEMS_CACHE_KEY: 'bitcraftMarketHelper_itemsCache',
        ITEMS_CACHE_VERSION: 'v1',
        UI_VERSION_KEY: 'bitcraftMarketHelper_uiVersion'
    };

    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================

    let toastTimeout = null;
    let toastElement = null;

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'success', 'error', 'warning', or 'info'
     * @param {number} duration - Duration in ms (default: 3000)
     */
    function showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
        // Create toast element if it doesn't exist
        if (!toastElement) {
            toastElement = document.createElement('div');
            toastElement.className = 'toast';
            toastElement.setAttribute('role', 'alert');
            toastElement.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastElement);
        }

        // Clear any existing timeout
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        // Set message and type
        toastElement.textContent = message;
        toastElement.className = `toast ${type}`;
        toastElement.style.display = 'block';

        // Auto-hide after duration
        toastTimeout = setTimeout(() => {
            toastElement.style.display = 'none';
        }, duration);
    }

    /**
     * Hide the current toast
     */
    function hideToast() {
        if (toastElement) {
            toastElement.style.display = 'none';
        }
        if (toastTimeout) {
            clearTimeout(toastTimeout);
            toastTimeout = null;
        }
    }

    // ============================================
    // CLIPBOARD OPERATIONS
    // ============================================

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @param {boolean} showNotification - Whether to show toast notification
     * @returns {Promise<boolean>} - Success status
     */
    async function copyToClipboard(text, showNotification = true) {
        try {
            await navigator.clipboard.writeText(text);
            if (showNotification) {
                showToast(`Copied: ${text}`, 'success');
            }
            return true;
        } catch (err) {
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                if (showNotification) {
                    showToast(`Copied: ${text}`, 'success');
                }
                return true;
            } catch (fallbackErr) {
                console.error('Failed to copy:', fallbackErr);
                if (showNotification) {
                    showToast('Failed to copy to clipboard', 'error');
                }
                return false;
            }
        }
    }

    // ============================================
    // STRING UTILITIES
    // ============================================

    /**
     * Escape HTML entities to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Format a number with locale-specific separators
     * @param {number} num - Number to format
     * @param {number} decimals - Number of decimal places
     * @returns {string} - Formatted number
     */
    function formatNumber(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) {
            return 'N/A';
        }
        return Number(num).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /**
     * Format a price value
     * @param {number} price - Price to format
     * @param {string} suffix - Currency suffix (default: 'hex')
     * @returns {string} - Formatted price
     */
    function formatPrice(price, suffix = 'hex') {
        if (price === null || price === undefined || isNaN(price)) {
            return 'N/A';
        }
        return `${formatNumber(price)} ${suffix}`;
    }

    /**
     * Format a relative time string
     * @param {number|Date} timestamp - Timestamp or Date object
     * @returns {string} - Relative time string
     */
    function formatRelativeTime(timestamp) {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) {
            return 'just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Truncate a string with ellipsis
     * @param {string} str - String to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} - Truncated string
     */
    function truncate(str, maxLength = 50) {
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }

    // ============================================
    // DEBOUNCE & THROTTLE
    // ============================================

    /**
     * Debounce a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} - Debounced function
     */
    function debounce(func, wait = CONFIG.DEBOUNCE_DELAY) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle a function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Minimum time between calls in ms
     * @returns {Function} - Throttled function
     */
    function throttle(func, limit = 100) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ============================================
    // DOM UTILITIES
    // ============================================

    /**
     * Query selector shorthand
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element (default: document)
     * @returns {Element|null} - Found element or null
     */
    function $(selector, context = document) {
        return context.querySelector(selector);
    }

    /**
     * Query selector all shorthand
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element (default: document)
     * @returns {NodeList} - Found elements
     */
    function $$(selector, context = document) {
        return context.querySelectorAll(selector);
    }

    /**
     * Create an element with attributes and children
     * @param {string} tag - Tag name
     * @param {Object} attrs - Attributes object
     * @param {Array|string} children - Child elements or text
     * @returns {Element} - Created element
     */
    function createElement(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);

        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.substring(2).toLowerCase(), value);
            } else if (key === 'dataset' && typeof value === 'object') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    el.dataset[dataKey] = dataValue;
                });
            } else {
                el.setAttribute(key, value);
            }
        });

        if (typeof children === 'string') {
            el.textContent = children;
        } else if (Array.isArray(children)) {
            children.forEach(child => {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child instanceof Element) {
                    el.appendChild(child);
                }
            });
        }

        return el;
    }

    /**
     * Show/hide an element
     * @param {Element|string} element - Element or selector
     * @param {boolean} show - Whether to show or hide
     */
    function toggleVisibility(element, show) {
        const el = typeof element === 'string' ? $(element) : element;
        if (el) {
            el.style.display = show ? '' : 'none';
        }
    }

    /**
     * Add/remove class based on condition
     * @param {Element|string} element - Element or selector
     * @param {string} className - Class name
     * @param {boolean} condition - Whether to add or remove
     */
    function toggleClass(element, className, condition) {
        const el = typeof element === 'string' ? $(element) : element;
        if (el) {
            el.classList.toggle(className, condition);
        }
    }

    // ============================================
    // MODAL MANAGEMENT
    // ============================================

    /**
     * Open a modal
     * @param {string|Element} modal - Modal element or selector
     */
    function openModal(modal) {
        const el = typeof modal === 'string' ? $(modal) : modal;
        if (el) {
            el.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Focus first focusable element
            const focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable) focusable.focus();
        }
    }

    /**
     * Close a modal
     * @param {string|Element} modal - Modal element or selector
     */
    function closeModal(modal) {
        const el = typeof modal === 'string' ? $(modal) : modal;
        if (el) {
            el.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Setup modal close on backdrop click and Escape key
     * @param {string|Element} modal - Modal element or selector
     */
    function setupModalBehavior(modal) {
        const el = typeof modal === 'string' ? $(modal) : modal;
        if (!el) return;

        // Close on backdrop click
        el.addEventListener('click', (e) => {
            if (e.target === el) {
                closeModal(el);
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.classList.contains('active')) {
                closeModal(el);
            }
        });

        // Close button
        const closeBtn = el.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeModal(el));
        }
    }

    // ============================================
    // API UTILITIES
    // ============================================

    /**
     * Fetch data with error handling and retry logic
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @param {number} retries - Number of retries
     * @returns {Promise<any>} - Response data
     */
    async function fetchWithRetry(url, options = {}, retries = 3) {
        let lastError;

        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);

                if (response.status === 429) {
                    // Rate limited - wait and retry
                    const waitTime = Math.pow(2, i) * 1000;
                    console.warn(`Rate limited, waiting ${waitTime}ms...`);
                    await sleep(waitTime);
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                lastError = error;
                if (i < retries - 1) {
                    const waitTime = Math.pow(2, i) * 500;
                    console.warn(`Fetch failed, retrying in ${waitTime}ms...`, error.message);
                    await sleep(waitTime);
                }
            }
        }

        throw lastError;
    }

    /**
     * Build API URL with base
     * @param {string} path - API path
     * @param {boolean} useProxy - Whether to use proxy (default: true)
     * @returns {string} - Full URL
     */
    function buildApiUrl(path, useProxy = true) {
        const baseUrl = useProxy ? CONFIG.API_BASE_URL : CONFIG.BITJITA_URL;
        return `${baseUrl}${path}`;
    }

    // ============================================
    // DATA CACHING
    // ============================================

    /**
     * Get cached items data
     * @returns {Object|null} - Cached data or null
     */
    function getCachedItems() {
        try {
            const cached = localStorage.getItem(CONFIG.ITEMS_CACHE_KEY);
            if (!cached) return null;

            const data = JSON.parse(cached);
            if (data.version !== CONFIG.ITEMS_CACHE_VERSION) {
                localStorage.removeItem(CONFIG.ITEMS_CACHE_KEY);
                return null;
            }

            // Check if cache is still valid (24 hours)
            const age = Date.now() - data.timestamp;
            if (age > 24 * 60 * 60 * 1000) {
                return null;
            }

            return data.items;
        } catch (error) {
            console.warn('Failed to read items cache:', error);
            return null;
        }
    }

    /**
     * Set cached items data
     * @param {Array} items - Items to cache
     */
    function setCachedItems(items) {
        try {
            const data = {
                version: CONFIG.ITEMS_CACHE_VERSION,
                timestamp: Date.now(),
                items: items
            };
            localStorage.setItem(CONFIG.ITEMS_CACHE_KEY, JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to cache items:', error);
        }
    }

    // ============================================
    // UI VERSION MANAGEMENT
    // ============================================

    /**
     * Get the current UI version preference
     * @returns {string} - 'classic' or 'enhanced'
     */
    function getUiVersion() {
        return localStorage.getItem(CONFIG.UI_VERSION_KEY) || 'classic';
    }

    /**
     * Set the UI version preference
     * @param {string} version - 'classic' or 'enhanced'
     */
    function setUiVersion(version) {
        localStorage.setItem(CONFIG.UI_VERSION_KEY, version);
    }

    /**
     * Create and insert the UI version toggle
     * @param {Function} onChange - Callback when version changes
     */
    function createVersionToggle(onChange) {
        const existingToggle = $('.version-toggle');
        if (existingToggle) return; // Already exists

        const currentVersion = getUiVersion();
        const toggle = createElement('div', { className: 'version-toggle' }, [
            createElement('label', {}, [
                createElement('input', {
                    type: 'checkbox',
                    id: 'uiVersionToggle',
                    checked: currentVersion === 'enhanced' ? 'checked' : null,
                    onChange: (e) => {
                        const newVersion = e.target.checked ? 'enhanced' : 'classic';
                        setUiVersion(newVersion);
                        if (onChange) onChange(newVersion);
                    }
                }),
                ' Enhanced UI'
            ])
        ]);

        document.body.appendChild(toggle);
    }

    // ============================================
    // RARITY & TIER UTILITIES
    // ============================================

    /**
     * Get CSS class for rarity
     * @param {string} rarity - Rarity string
     * @returns {string} - CSS class name
     */
    function getRarityClass(rarity) {
        if (!rarity) return 'rarity-common';
        const normalized = rarity.toLowerCase().replace(/\s+/g, '-');
        return `rarity-${normalized}`;
    }

    /**
     * Get display name for rarity
     * @param {string} rarity - Rarity string
     * @returns {string} - Display name
     */
    function formatRarity(rarity) {
        if (!rarity) return 'Common';
        return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
    }

    /**
     * Sort items by rarity (Common < Uncommon < Rare < Epic < Legendary < Mythic)
     * @param {string} a - First rarity
     * @param {string} b - Second rarity
     * @returns {number} - Sort order
     */
    function compareRarity(a, b) {
        const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
        const aIndex = order.indexOf((a || 'common').toLowerCase());
        const bIndex = order.indexOf((b || 'common').toLowerCase());
        return aIndex - bIndex;
    }

    // ============================================
    // URL STATE MANAGEMENT
    // ============================================

    /**
     * Get URL search parameters as object
     * @returns {Object} - Parameters object
     */
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            if (result[key]) {
                // Handle multiple values
                if (Array.isArray(result[key])) {
                    result[key].push(value);
                } else {
                    result[key] = [result[key], value];
                }
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    /**
     * Update URL with parameters without page reload
     * @param {Object} params - Parameters to set
     * @param {boolean} replace - Replace history instead of push
     */
    function setUrlParams(params, replace = false) {
        const url = new URL(window.location);
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                url.searchParams.delete(key);
            } else if (Array.isArray(value)) {
                url.searchParams.delete(key);
                value.forEach(v => url.searchParams.append(key, v));
            } else {
                url.searchParams.set(key, value);
            }
        });

        if (replace) {
            window.history.replaceState({}, '', url);
        } else {
            window.history.pushState({}, '', url);
        }
    }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================

    const keyboardHandlers = new Map();

    /**
     * Register a keyboard shortcut
     * @param {string} shortcut - Shortcut string (e.g., 'ctrl+k', 'escape')
     * @param {Function} handler - Handler function
     * @param {string} description - Description for help
     */
    function registerShortcut(shortcut, handler, description = '') {
        keyboardHandlers.set(shortcut.toLowerCase(), { handler, description });
    }

    /**
     * Initialize keyboard shortcut listener
     */
    function initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.matches('input, textarea, select')) return;

            const parts = [];
            if (e.ctrlKey || e.metaKey) parts.push('ctrl');
            if (e.altKey) parts.push('alt');
            if (e.shiftKey) parts.push('shift');
            parts.push(e.key.toLowerCase());

            const shortcut = parts.join('+');
            const entry = keyboardHandlers.get(shortcut);

            if (entry) {
                e.preventDefault();
                entry.handler(e);
            }
        });
    }

    /**
     * Get all registered shortcuts with descriptions
     * @returns {Array} - Array of {shortcut, description}
     */
    function getShortcuts() {
        return Array.from(keyboardHandlers.entries())
            .map(([shortcut, { description }]) => ({ shortcut, description }))
            .filter(s => s.description);
    }

    // ============================================
    // SORTING UTILITIES
    // ============================================

    /**
     * Sort an array of objects by a key
     * @param {Array} arr - Array to sort
     * @param {string} key - Key to sort by
     * @param {boolean} ascending - Sort direction
     * @returns {Array} - Sorted array
     */
    function sortBy(arr, key, ascending = true) {
        return [...arr].sort((a, b) => {
            let aVal = a[key];
            let bVal = b[key];

            // Handle null/undefined
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return ascending ? 1 : -1;
            if (bVal == null) return ascending ? -1 : 1;

            // Handle numbers
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return ascending ? aVal - bVal : bVal - aVal;
            }

            // Handle strings
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
            return ascending
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        });
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Sleep for a given number of milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate a unique ID
     * @returns {string} - Unique ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Check if running on mobile device
     * @returns {boolean}
     */
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Check if dark mode is preferred by system
     * @returns {boolean}
     */
    function prefersDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // ============================================
    // EXPORT PUBLIC API
    // ============================================

    return {
        // Configuration
        CONFIG,

        // Toast
        showToast,
        hideToast,

        // Clipboard
        copyToClipboard,

        // Strings
        escapeHtml,
        formatNumber,
        formatPrice,
        formatRelativeTime,
        truncate,

        // Timing
        debounce,
        throttle,
        sleep,

        // DOM
        $,
        $$,
        createElement,
        toggleVisibility,
        toggleClass,

        // Modals
        openModal,
        closeModal,
        setupModalBehavior,

        // API
        fetchWithRetry,
        buildApiUrl,

        // Caching
        getCachedItems,
        setCachedItems,

        // UI Version
        getUiVersion,
        setUiVersion,
        createVersionToggle,

        // Rarity/Tier
        getRarityClass,
        formatRarity,
        compareRarity,

        // URL
        getUrlParams,
        setUrlParams,

        // Keyboard
        registerShortcut,
        initKeyboardShortcuts,
        getShortcuts,

        // Sorting
        sortBy,

        // Helpers
        generateId,
        isMobile,
        prefersDarkMode
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.BitcraftUtils = BitcraftUtils;
}

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BitcraftUtils;
}
