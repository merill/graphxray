// Firefox wrapper for background script
// This file handles the differences between Chrome's service worker (MV3) and Firefox's background script (MV2)

// Import the main background logic
import './index.js';

// Firefox uses browser API instead of chrome API, but chrome API is also available
// We'll use browser API for better Firefox compatibility
const api = typeof browser !== 'undefined' ? browser : chrome;

// Initialize extension
api.runtime.onInstalled.addListener(async function(details) {
  console.log('Graph X-Ray extension installed', details);
});

// Handle extension icon click if not using popup
api.browserAction.onClicked.addListener(function(tab) {
  // This will only fire if no popup is set in manifest
  console.log('Extension icon clicked');
});

// Message handling for communication between content scripts and background
api.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);
  
  // Handle async response
  if (request.async) {
    handleAsyncMessage(request, sender).then(sendResponse);
    return true; // Indicates async response
  }
  
  // Handle sync response
  return false;
});

async function handleAsyncMessage(request, sender) {
  // Add async message handling logic here
  return { success: true };
}

// Tab event listeners
api.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    // Tab finished loading
    console.log('Tab loaded:', tab.url);
  }
});

api.tabs.onActivated.addListener(function(activeInfo) {
  console.log('Tab activated:', activeInfo);
});

// Web request handling (if needed for API interception)
// Note: Firefox requires "webRequest" permission in manifest
if (api.webRequest) {
  api.webRequest.onBeforeRequest.addListener(
    function(details) {
      // Handle Graph API requests
      if (details.url.includes('graph.microsoft.com') || details.url.includes('graph.microsoft.us')) {
        console.log('Graph API request detected:', details.url);
      }
    },
    { urls: ["https://graph.microsoft.com/*", "https://graph.microsoft.us/*"] },
    ["requestBody"]
  );
}

console.log('Graph X-Ray background script loaded');