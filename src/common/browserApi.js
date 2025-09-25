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

// Helper for storage API with promise support
export const storage = {
  local: {
    get: (keys) => {
      if (isFirefox()) {
        // Firefox returns promises natively
        return browserAPI.storage.local.get(keys);
      } else {
        // Chrome uses callbacks, wrap in promise
        return new Promise((resolve, reject) => {
          browserAPI.storage.local.get(keys, (result) => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        });
      }
    },
    set: (items) => {
      if (isFirefox()) {
        return browserAPI.storage.local.set(items);
      } else {
        return new Promise((resolve, reject) => {
          browserAPI.storage.local.set(items, () => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    },
    remove: (keys) => {
      if (isFirefox()) {
        return browserAPI.storage.local.remove(keys);
      } else {
        return new Promise((resolve, reject) => {
          browserAPI.storage.local.remove(keys, () => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    },
    clear: () => {
      if (isFirefox()) {
        return browserAPI.storage.local.clear();
      } else {
        return new Promise((resolve, reject) => {
          browserAPI.storage.local.clear(() => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    }
  }
};

// Helper for tabs API with promise support
export const tabs = {
  query: (queryInfo) => {
    if (isFirefox()) {
      return browserAPI.tabs.query(queryInfo);
    } else {
      return new Promise((resolve, reject) => {
        browserAPI.tabs.query(queryInfo, (tabs) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(tabs);
          }
        });
      });
    }
  },
  sendMessage: (tabId, message) => {
    if (isFirefox()) {
      return browserAPI.tabs.sendMessage(tabId, message);
    } else {
      return new Promise((resolve, reject) => {
        browserAPI.tabs.sendMessage(tabId, message, (response) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    }
  }
};

// Helper for runtime API
export const runtime = {
  sendMessage: (message) => {
    if (isFirefox()) {
      return browserAPI.runtime.sendMessage(message);
    } else {
      return new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(message, (response) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    }
  },
  onMessage: browserAPI ? browserAPI.runtime.onMessage : null,
  onInstalled: browserAPI ? browserAPI.runtime.onInstalled : null,
  getManifest: browserAPI ? browserAPI.runtime.getManifest : null
};

export default browserAPI;