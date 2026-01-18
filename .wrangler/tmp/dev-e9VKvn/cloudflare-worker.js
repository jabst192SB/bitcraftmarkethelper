var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-D7rzNh/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// cloudflare-worker.js
var TARGET_API = "https://bitjita.com";
var MONITOR_REGION_ID = 4;
var MarketMonitor = class {
  static {
    __name(this, "MarketMonitor");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  /**
   * Handle requests to the Durable Object
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/api/monitor/state") {
      return this.getState();
    } else if (path === "/api/monitor/changes") {
      const limit = parseInt(url.searchParams.get("limit")) || 50;
      return this.getChanges(limit);
    } else if (path === "/api/monitor/update") {
      const data = await request.json();
      return this.updateState(data.marketData, data.orderDetails || {});
    } else if (path === "/api/monitor/reset") {
      return this.resetState();
    }
    return new Response("Not found", { status: 404 });
  }
  /**
   * Get current market state
   */
  async getState() {
    const currentState = await this.state.storage.get("currentState");
    const orderDetails = await this.state.storage.get("orderDetails") || {};
    const lastUpdate = await this.state.storage.get("lastUpdate");
    const changeCount = await this.state.storage.get("changeCount") || 0;
    return new Response(JSON.stringify({
      currentState: currentState || null,
      orderDetails,
      lastUpdate: lastUpdate || null,
      changeCount,
      timestamp: Date.now()
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  /**
   * Get recent changes
   */
  async getChanges(limit = 50) {
    const changes = await this.state.storage.get("changes") || [];
    return new Response(JSON.stringify({
      changes: changes.slice(-limit),
      total: changes.length,
      timestamp: Date.now()
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  /**
   * Update state with new market data and detect changes
   * @param {Object} newData - Market data with items array
   * @param {Object} orderDetails - Optional order details keyed by item ID
   */
  async updateState(newData, orderDetails = {}) {
    const previousState = await this.state.storage.get("currentState");
    const previousOrderDetails = await this.state.storage.get("orderDetails") || {};
    const changes = await this.state.storage.get("changes") || [];
    let changeCount = await this.state.storage.get("changeCount") || 0;
    const detectedChanges = this.detectChanges(previousState, newData);
    if (detectedChanges.length > 0) {
      const changesWithOrders = detectedChanges.map((change) => {
        const currentDetails = orderDetails[change.itemId];
        const prevDetails = previousOrderDetails[change.itemId];
        if (currentDetails) {
          const orderDiff = this.diffOrders(prevDetails, currentDetails);
          return {
            ...change,
            orderDetails: {
              sellOrders: currentDetails.sellOrders,
              buyOrders: currentDetails.buyOrders,
              stats: currentDetails.stats
            },
            addedOrders: orderDiff.added,
            removedOrders: orderDiff.removed
          };
        }
        return change;
      });
      const changeEntry = {
        timestamp: Date.now(),
        changes: changesWithOrders
      };
      changes.push(changeEntry);
      if (changes.length > 1e3) {
        changes.shift();
      }
      changeCount += detectedChanges.length;
      await this.state.storage.put("changes", changes);
      await this.state.storage.put("changeCount", changeCount);
    }
    await this.state.storage.put("currentState", newData);
    await this.state.storage.put("orderDetails", orderDetails);
    await this.state.storage.put("lastUpdate", Date.now());
    return new Response(JSON.stringify({
      success: true,
      changesDetected: detectedChanges.length,
      totalChanges: changeCount,
      itemsWithOrderDetails: Object.keys(orderDetails).length
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  /**
   * Diff orders between previous and current state to find added/removed orders
   */
  diffOrders(prevDetails, currentDetails) {
    const added = { sellOrders: [], buyOrders: [] };
    const removed = { sellOrders: [], buyOrders: [] };
    if (!prevDetails) {
      added.sellOrders = (currentDetails.sellOrders || []).map((order) => ({
        claimName: order.claimName,
        claimEntityId: order.claimEntityId,
        ownerName: order.ownerName || order.playerName,
        ownerEntityId: order.ownerEntityId || order.playerEntityId,
        quantity: order.quantity,
        priceThreshold: order.priceThreshold,
        regionId: order.regionId
      }));
      added.buyOrders = (currentDetails.buyOrders || []).map((order) => ({
        claimName: order.claimName,
        claimEntityId: order.claimEntityId,
        ownerName: order.ownerName || order.playerName,
        ownerEntityId: order.ownerEntityId || order.playerEntityId,
        quantity: order.quantity,
        priceThreshold: order.priceThreshold,
        regionId: order.regionId
      }));
      return { added, removed };
    }
    const createOrderKey = /* @__PURE__ */ __name((order) => `${order.claimEntityId || order.claimName}_${order.priceThreshold}_${order.quantity}`, "createOrderKey");
    const prevSellKeys = /* @__PURE__ */ new Map();
    (prevDetails.sellOrders || []).forEach((order) => {
      prevSellKeys.set(createOrderKey(order), order);
    });
    const currSellKeys = /* @__PURE__ */ new Map();
    (currentDetails.sellOrders || []).forEach((order) => {
      currSellKeys.set(createOrderKey(order), order);
    });
    for (const [key, order] of currSellKeys) {
      if (!prevSellKeys.has(key)) {
        added.sellOrders.push({
          claimName: order.claimName,
          claimEntityId: order.claimEntityId,
          ownerName: order.ownerName || order.playerName,
          ownerEntityId: order.ownerEntityId || order.playerEntityId,
          quantity: order.quantity,
          priceThreshold: order.priceThreshold,
          regionId: order.regionId
        });
      }
    }
    for (const [key, order] of prevSellKeys) {
      if (!currSellKeys.has(key)) {
        removed.sellOrders.push({
          claimName: order.claimName,
          claimEntityId: order.claimEntityId,
          ownerName: order.ownerName || order.playerName,
          ownerEntityId: order.ownerEntityId || order.playerEntityId,
          quantity: order.quantity,
          priceThreshold: order.priceThreshold,
          regionId: order.regionId
        });
      }
    }
    const prevBuyKeys = /* @__PURE__ */ new Map();
    (prevDetails.buyOrders || []).forEach((order) => {
      prevBuyKeys.set(createOrderKey(order), order);
    });
    const currBuyKeys = /* @__PURE__ */ new Map();
    (currentDetails.buyOrders || []).forEach((order) => {
      currBuyKeys.set(createOrderKey(order), order);
    });
    for (const [key, order] of currBuyKeys) {
      if (!prevBuyKeys.has(key)) {
        added.buyOrders.push({
          claimName: order.claimName,
          claimEntityId: order.claimEntityId,
          ownerName: order.ownerName || order.playerName,
          ownerEntityId: order.ownerEntityId || order.playerEntityId,
          quantity: order.quantity,
          priceThreshold: order.priceThreshold,
          regionId: order.regionId
        });
      }
    }
    for (const [key, order] of prevBuyKeys) {
      if (!currBuyKeys.has(key)) {
        removed.buyOrders.push({
          claimName: order.claimName,
          claimEntityId: order.claimEntityId,
          ownerName: order.ownerName || order.playerName,
          ownerEntityId: order.ownerEntityId || order.playerEntityId,
          quantity: order.quantity,
          priceThreshold: order.priceThreshold,
          regionId: order.regionId
        });
      }
    }
    return { added, removed };
  }
  /**
   * Detect changes between previous and new market states
   */
  detectChanges(previousState, newState) {
    const changes = [];
    if (!previousState || !previousState.items) {
      return changes;
    }
    const prevMap = /* @__PURE__ */ new Map();
    previousState.items.forEach((item) => {
      prevMap.set(item.id, item);
    });
    const newMap = /* @__PURE__ */ new Map();
    newState.items.forEach((item) => {
      newMap.set(item.id, item);
    });
    for (const newItem of newState.items) {
      const prevItem = prevMap.get(newItem.id);
      if (!prevItem) {
        if (newItem.totalOrders > 0) {
          changes.push({
            type: "new_item",
            itemId: newItem.id,
            itemName: newItem.name,
            sellOrders: newItem.sellOrders,
            buyOrders: newItem.buyOrders,
            totalOrders: newItem.totalOrders
          });
        }
        continue;
      }
      const sellOrderChange = newItem.sellOrders - prevItem.sellOrders;
      const buyOrderChange = newItem.buyOrders - prevItem.buyOrders;
      const totalOrderChange = newItem.totalOrders - prevItem.totalOrders;
      if (sellOrderChange !== 0 || buyOrderChange !== 0 || totalOrderChange !== 0) {
        changes.push({
          type: "order_change",
          itemId: newItem.id,
          itemName: newItem.name,
          previous: {
            sellOrders: prevItem.sellOrders,
            buyOrders: prevItem.buyOrders,
            totalOrders: prevItem.totalOrders
          },
          current: {
            sellOrders: newItem.sellOrders,
            buyOrders: newItem.buyOrders,
            totalOrders: newItem.totalOrders
          },
          delta: {
            sellOrders: sellOrderChange,
            buyOrders: buyOrderChange,
            totalOrders: totalOrderChange
          }
        });
      }
    }
    for (const prevItem of previousState.items) {
      if (!newMap.has(prevItem.id) && prevItem.totalOrders > 0) {
        changes.push({
          type: "item_removed",
          itemId: prevItem.id,
          itemName: prevItem.name,
          previous: {
            sellOrders: prevItem.sellOrders,
            buyOrders: prevItem.buyOrders,
            totalOrders: prevItem.totalOrders
          }
        });
      }
    }
    return changes;
  }
  /**
   * Reset state (for debugging)
   */
  async resetState() {
    await this.state.storage.deleteAll();
    return new Response(JSON.stringify({
      success: true,
      message: "State reset successfully"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
var cloudflare_worker_default = {
  /**
   * Handle fetch requests
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }
    if (url.pathname.startsWith("/api/monitor/")) {
      return handleMonitorRequest(request, env);
    }
    return handleProxyRequest(request, env);
  },
  /**
   * Handle scheduled events (cron)
   */
  async scheduled(event, env, ctx) {
    console.log("Cron triggered at:", new Date(event.scheduledTime).toISOString());
    try {
      const marketData = await fetchMarketData();
      console.log(`Found ${marketData.items.length} items with orders`);
      const id = env.MARKET_MONITOR.idFromName("global");
      const stub = env.MARKET_MONITOR.get(id);
      const stateResponse = await stub.fetch(new Request("https://dummy/api/monitor/state"));
      const stateData = await stateResponse.json();
      const previousState = stateData.currentState;
      const previousOrderDetails = stateData.orderDetails || {};
      const changedItemIds = detectChangedItemIds(previousState, marketData);
      console.log(`Detected ${changedItemIds.length} changed items`);
      const allItemIds = marketData.items.map((item) => item.id);
      let orderDetails = { ...previousOrderDetails };
      for (const key of Object.keys(orderDetails)) {
        if (!allItemIds.includes(parseInt(key))) {
          delete orderDetails[key];
        }
      }
      if (changedItemIds.length > 0) {
        console.log(`Fetching order details for ${changedItemIds.length} changed items`);
        const changedOrderDetails = await fetchOrdersForItems(changedItemIds);
        orderDetails = { ...orderDetails, ...changedOrderDetails };
        console.log(`Updated order details for ${Object.keys(changedOrderDetails).length} items`);
      }
      console.log(`Total order details: ${Object.keys(orderDetails).length} items`);
      const response = await stub.fetch(new Request("https://dummy/api/monitor/update", {
        method: "POST",
        body: JSON.stringify({
          marketData,
          orderDetails
        }),
        headers: { "Content-Type": "application/json" }
      }));
      const result = await response.json();
      console.log("Market update result:", result);
    } catch (error) {
      console.error("Error in scheduled task:", error);
    }
  }
};
async function handleMonitorRequest(request, env) {
  try {
    const id = env.MARKET_MONITOR.idFromName("global");
    const stub = env.MARKET_MONITOR.get(id);
    const response = await stub.fetch(request);
    const newResponse = new Response(response.body, response);
    addCorsHeaders(newResponse);
    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Monitor API error",
      message: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleMonitorRequest, "handleMonitorRequest");
async function handleProxyRequest(request, env) {
  const url = new URL(request.url);
  try {
    const targetUrl = TARGET_API + url.pathname + url.search;
    console.log(`Proxying ${request.method} request to: ${targetUrl}`);
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null
    });
    const response = await fetch(proxyRequest);
    const newResponse = new Response(response.body, response);
    addCorsHeaders(newResponse);
    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Proxy error",
      message: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleProxyRequest, "handleProxyRequest");
function detectChangedItemIds(previousState, newState) {
  const changedIds = [];
  if (!previousState || !previousState.items) {
    return changedIds;
  }
  const prevMap = /* @__PURE__ */ new Map();
  previousState.items.forEach((item) => {
    prevMap.set(item.id, item);
  });
  const newMap = /* @__PURE__ */ new Map();
  newState.items.forEach((item) => {
    newMap.set(item.id, item);
  });
  for (const newItem of newState.items) {
    const prevItem = prevMap.get(newItem.id);
    if (!prevItem) {
      if (newItem.totalOrders > 0) {
        changedIds.push(newItem.id);
      }
      continue;
    }
    const sellOrderChange = newItem.sellOrders - prevItem.sellOrders;
    const buyOrderChange = newItem.buyOrders - prevItem.buyOrders;
    const totalOrderChange = newItem.totalOrders - prevItem.totalOrders;
    if (sellOrderChange !== 0 || buyOrderChange !== 0 || totalOrderChange !== 0) {
      changedIds.push(newItem.id);
    }
  }
  for (const prevItem of previousState.items) {
    if (!newMap.has(prevItem.id) && prevItem.totalOrders > 0) {
      changedIds.push(prevItem.id);
    }
  }
  return changedIds;
}
__name(detectChangedItemIds, "detectChangedItemIds");
async function fetchMarketData() {
  const apiUrl = `${TARGET_API}/api/market?hasOrders=true`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  return {
    items: data.data?.items || [],
    fetchedAt: Date.now()
  };
}
__name(fetchMarketData, "fetchMarketData");
async function fetchItemOrders(itemId) {
  const apiUrl = `${TARGET_API}/api/market/item/${itemId}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    console.error(`Failed to fetch orders for item ${itemId}: ${response.status}`);
    return null;
  }
  const data = await response.json();
  const sellOrders = (data.sellOrders || []).filter((order) => order.regionId === MONITOR_REGION_ID);
  const buyOrders = (data.buyOrders || []).filter((order) => order.regionId === MONITOR_REGION_ID);
  return {
    itemId,
    sellOrders,
    buyOrders,
    stats: data.stats || {}
  };
}
__name(fetchItemOrders, "fetchItemOrders");
async function fetchOrdersForItems(itemIds, previousOrderDetails = {}) {
  const results = { ...previousOrderDetails };
  for (const key of Object.keys(results)) {
    if (!itemIds.includes(parseInt(key))) {
      delete results[key];
    }
  }
  console.log(`Need to fetch ${itemIds.length} items`);
  const batchSize = 99;
  const delayBetweenBatches = 100;
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    const promises = batch.map((id) => fetchItemOrders(id));
    const batchResults = await Promise.all(promises);
    batchResults.forEach((result) => {
      if (result) {
        results[result.itemId] = result;
      }
    });
    if (itemIds.length > 20 && (i + batchSize) % 50 === 0) {
      console.log(`Fetched ${Math.min(i + batchSize, itemIds.length)}/${itemIds.length} items`);
    }
    if (i + batchSize < itemIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }
  return results;
}
__name(fetchOrdersForItems, "fetchOrdersForItems");
function addCorsHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
__name(addCorsHeaders, "addCorsHeaders");
function handleOptions(request) {
  const headers = request.headers;
  if (headers.get("Origin") !== null && headers.get("Access-Control-Request-Method") !== null && headers.get("Access-Control-Request-Headers") !== null) {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": headers.get("Access-Control-Request-Headers"),
        "Access-Control-Max-Age": "86400"
        // 24 hours
      }
    });
  } else {
    return new Response(null, {
      headers: {
        "Allow": "GET, POST, PUT, DELETE, OPTIONS"
      }
    });
  }
}
__name(handleOptions, "handleOptions");

// C:/Users/jbair/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/jbair/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-scheduled.ts
var scheduled = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  const url = new URL(request.url);
  if (url.pathname === "/__scheduled") {
    const cron = url.searchParams.get("cron") ?? "";
    await middlewareCtx.dispatch("scheduled", { cron });
    return new Response("Ran scheduled event");
  }
  const resp = await middlewareCtx.next(request, env);
  if (request.headers.get("referer")?.endsWith("/__scheduled") && url.pathname === "/favicon.ico" && resp.status === 500) {
    return new Response(null, { status: 404 });
  }
  return resp;
}, "scheduled");
var middleware_scheduled_default = scheduled;

// C:/Users/jbair/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-D7rzNh/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_scheduled_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = cloudflare_worker_default;

// C:/Users/jbair/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-D7rzNh/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  MarketMonitor,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=cloudflare-worker.js.map
