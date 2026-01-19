/**
 * Supabase Client Utility
 * Simple REST API client for Supabase (no SDK needed)
 */

import https from 'https';
import http from 'http';

class SupabaseClient {
  constructor(supabaseUrl, supabaseKey) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Key are required');
    }

    this.supabaseUrl = supabaseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.supabaseKey = supabaseKey;
    this.headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  /**
   * Make HTTP request to Supabase REST API
   */
  async request(method, path, body = null, extraHeaders = {}) {
    const url = new URL(`${this.supabaseUrl}${path}`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: { ...this.headers, ...extraHeaders }
      };

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch (e) {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Upsert market items (bulk insert/update)
   */
  async upsertMarketItems(items) {
    const path = '/rest/v1/market_items';
    // Add Prefer header for upsert (on conflict, update)
    return this.request('POST', path, items, {
      'Prefer': 'resolution=merge-duplicates'
    });
  }

  /**
   * Upsert order details for a single item
   */
  async upsertOrderDetails(itemId, details) {
    const path = '/rest/v1/order_details';
    const body = {
      item_id: itemId,
      sell_orders: details.sellOrders || [],
      buy_orders: details.buyOrders || [],
      stats: details.stats || {},
      last_updated: new Date().toISOString()
    };
    return this.request('POST', path, body, {
      'Prefer': 'resolution=merge-duplicates'
    });
  }

  /**
   * Upsert multiple order details (bulk)
   */
  async upsertOrderDetailsBulk(orderDetailsArray) {
    const path = '/rest/v1/order_details';
    return this.request('POST', path, orderDetailsArray, {
      'Prefer': 'resolution=merge-duplicates'
    });
  }

  /**
   * Insert change entry
   */
  async insertChange(changes) {
    const path = '/rest/v1/market_changes';
    const body = {
      timestamp: new Date().toISOString(),
      changes: changes
    };
    return this.request('POST', path, body);
  }

  /**
   * Get market state (all items with orders)
   */
  async getMarketItems() {
    const path = '/rest/v1/market_items?select=*&order=last_updated.desc';
    return this.request('GET', path);
  }

  /**
   * Get order details for specific items
   */
  async getOrderDetails(itemIds = null) {
    let path = '/rest/v1/order_details?select=*';
    if (itemIds && itemIds.length > 0) {
      const idsParam = itemIds.join(',');
      path += `&item_id=in.(${idsParam})`;
    }
    return this.request('GET', path);
  }

  /**
   * Get recent changes
   */
  async getChanges(limit = 50) {
    const path = `/rest/v1/market_changes?select=*&order=timestamp.desc&limit=${limit}`;
    return this.request('GET', path);
  }

  /**
   * Get metadata value
   */
  async getMetadata(key) {
    const path = `/rest/v1/monitor_metadata?select=*&key=eq.${key}`;
    const result = await this.request('GET', path);
    return result && result.length > 0 ? result[0].value : null;
  }

  /**
   * Update metadata value
   */
  async updateMetadata(key, value) {
    const path = '/rest/v1/monitor_metadata';
    const body = {
      key: key,
      value: value,
      updated_at: new Date().toISOString()
    };
    return this.request('POST', path, body, {
      'Prefer': 'resolution=merge-duplicates'
    });
  }

  /**
   * Cleanup old changes (keep last 1000)
   */
  async cleanupOldChanges() {
    const path = '/rest/v1/rpc/cleanup_old_changes';
    return this.request('POST', path);
  }

  /**
   * Get full state (for monitor page)
   */
  async getFullState() {
    const [items, orderDetails, metadata, changes] = await Promise.all([
      this.getMarketItems(),
      this.getOrderDetails(),
      Promise.all([
        this.getMetadata('last_update'),
        this.getMetadata('change_count')
      ]),
      this.getChanges(50)
    ]);

    // Convert order details array to object keyed by item_id
    const orderDetailsObj = {};
    orderDetails.forEach(detail => {
      orderDetailsObj[detail.item_id] = {
        sellOrders: detail.sell_orders,
        buyOrders: detail.buy_orders,
        stats: detail.stats
      };
    });

    // Convert items array to market state format
    const currentState = {
      items: items.map(item => ({
        id: item.item_id,
        name: item.item_name,
        itemType: item.item_type,
        sellOrders: item.sell_orders,
        buyOrders: item.buy_orders,
        totalOrders: item.total_orders
      })),
      fetchedAt: metadata[0] || Date.now()
    };

    return {
      currentState,
      orderDetails: orderDetailsObj,
      lastUpdate: metadata[0],
      changeCount: metadata[1] || 0,
      changes: changes
    };
  }
}

export default SupabaseClient;
