/* eslint-disable no-redeclare */
// Browser API compatibility layer
// This module provides a unified API that works across Chrome and Firefox

// Detect which API is available
const getBrowserAPI = () => {
  // Firefox uses 'browser' API
  if (typeof browser !== "undefined" && browser.runtime) {
    return browser;
  }
  // Chrome uses 'chrome' API
  if (typeof chrome !== "undefined" && chrome.runtime) {
    // Wrap Chrome API to return promises like Firefox
    return new Proxy(chrome, {
      get(target, prop) {
        const item = target[prop];
        if (typeof item === "object" && item !== null) {
          return new Proxy(item, {
            get(subTarget, subProp) {
              const subItem = subTarget[subProp];
              if (typeof subItem === "function") {
                return (...args) => {
                  return new Promise((resolve, reject) => {
                    // Check if last argument is a callback
                    const lastArg = args[args.length - 1];
                    if (typeof lastArg === "function") {
                      // Already has callback, use it directly
                      subItem.apply(subTarget, args);
                    } else {
                      // Add callback to promisify
                      subItem.apply(subTarget, [
                        ...args,
                        (result) => {
                          if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                          } else {
                            resolve(result);
                          }
                        },
                      ]);
                    }
                  });
                };
              }
              return subItem;
            },
          });
        }
        return item;
      },
    });
  }
  throw new Error("No browser API found");
};

// Export the unified browser API
export const browserAPI = getBrowserAPI();

// Helper function to detect browser type
export const getBrowserType = () => {
  if (typeof browser !== "undefined" && browser.runtime) {
    return "firefox";
  }
  if (typeof chrome !== "undefined" && chrome.runtime) {
    return "chrome";
  }
  return "unknown";
};

// Helper for manifest differences
export const getManifestKey = (chromeKey, firefoxKey) => {
  return getBrowserType() === "firefox" ? firefoxKey : chromeKey;
};
