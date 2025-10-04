// Cross-browser API wrapper for Firefox and Chrome/Edge compatibility
// This module provides a unified API that works across different browsers

// Detect which API to use
const getBrowserAPI = () => {
  // Firefox uses 'browser' namespace
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  // Chrome/Edge uses 'chrome' namespace
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }
  // Fallback for environments where neither is available (e.g., testing)
  return null;
};

// Export the browser API
export const browserAPI = getBrowserAPI();

// Helper to check if we're running in Firefox
export const isFirefox = () => {
  return typeof browser !== 'undefined' && browser.runtime;
};

// Helper to check if we're running in Chrome/Edge
export const isChrome = () => {
  return typeof chrome !== 'undefined' && chrome.runtime && !isFirefox();
};

// Helper to get the manifest version
export const getManifestVersion = () => {
  if (browserAPI && browserAPI.runtime && browserAPI.runtime.getManifest) {
    return browserAPI.runtime.getManifest().manifest_version;
  }
  return null;
};

// Helper for devtools API compatibility
export const getDevtoolsAPI = () => {
  if (typeof browser !== 'undefined' && browser.devtools) {
    return browser.devtools;
  }
  if (typeof chrome !== 'undefined' && chrome.devtools) {
    return chrome.devtools;
  }
  return null;
};

// Helper to promisify Chrome callback-based APIs
// Firefox returns promises natively, so we only wrap for Chrome
// Preserves 'this' binding by accepting context object
const promisify = (apiFunc, context, ...args) => {
  if (isFirefox()) {
    // Firefox APIs return promises natively
    return apiFunc.call(context, ...args);
  }
  // Chrome uses callbacks, wrap in promise
  return new Promise((resolve, reject) => {
    apiFunc.call(context, ...args, (result) => {
      if (browserAPI.runtime.lastError) {
        reject(browserAPI.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
};

// Helper for storage API with promise support
export const storage = {
  local: {
    get: (keys) => promisify(browserAPI.storage.local.get, browserAPI.storage.local, keys),
    set: (items) => promisify(browserAPI.storage.local.set, browserAPI.storage.local, items),
    remove: (keys) => promisify(browserAPI.storage.local.remove, browserAPI.storage.local, keys),
    clear: () => promisify(browserAPI.storage.local.clear, browserAPI.storage.local)
  }
};

// Helper for tabs API with promise support
export const tabs = {
  query: (queryInfo) => promisify(browserAPI.tabs.query, browserAPI.tabs, queryInfo),
  sendMessage: (tabId, message) => promisify(browserAPI.tabs.sendMessage, browserAPI.tabs, tabId, message)
};

// Helper for runtime API
export const runtime = {
  sendMessage: (message) => promisify(browserAPI.runtime.sendMessage, browserAPI.runtime, message),
  onMessage: browserAPI ? browserAPI.runtime.onMessage : null,
  onInstalled: browserAPI ? browserAPI.runtime.onInstalled : null,
  getManifest: browserAPI ? browserAPI.runtime.getManifest : null
};

// Helper for webRequest API
// Note: webRequest is callback-based in both Chrome and Firefox
// Firefox also supports promises but we'll use callbacks for consistency
export const webRequest = {
  onBeforeRequest: {
    addListener: (callback, filter, extraInfoSpec) => {
      if (browserAPI && browserAPI.webRequest) {
        browserAPI.webRequest.onBeforeRequest.addListener(callback, filter, extraInfoSpec);
      }
    },
    removeListener: (callback) => {
      if (browserAPI && browserAPI.webRequest) {
        browserAPI.webRequest.onBeforeRequest.removeListener(callback);
      }
    }
  }
};

export default browserAPI;