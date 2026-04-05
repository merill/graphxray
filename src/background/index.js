import {
  saveObjectInLocalStorage,
} from "../common/storage.js";
import { runtime, webRequest, isFirefox } from "../common/browserApi.js";
import { getAllDomainUrls } from "../common/domains.js";

// This needs to be an export due to typescript implementation limitation of needing '--isolatedModules' tsconfig
export async function init() {
  // Store request bodies temporarily
  const requestBodies = new Map();

  // Initialize storage
  runtime.onInstalled.addListener(async function (details) {
    await saveObjectInLocalStorage({
      currentMetrics: {
        urls: [],
      },
      contextSwitches: 0,
      stack: [],
      isActive: false,
    });
  });

  // NOTE: webRequest API with requestBody is not supported in Manifest V3 service workers (Chrome)
  // Firefox uses Manifest V2 with background scripts which supports webRequest
  // Only enable webRequest for Firefox
  if (isFirefox()) {
    // Capture request bodies for Graph API calls (Firefox only)
    webRequest.onBeforeRequest.addListener(
      function (details) {
        console.log("Background - webRequest intercepted:", details.url, details.method);
        if (details.requestBody) {
          // Store the request body temporarily with URL as key
          let bodyData = "";
          if (details.requestBody.raw) {
            // Handle raw body data
            const decoder = new TextDecoder("utf-8");
            bodyData = details.requestBody.raw
              .map(data => decoder.decode(data.bytes))
              .join("");
          } else if (details.requestBody.formData) {
            // Handle form data
            bodyData = JSON.stringify(details.requestBody.formData);
          }

          console.log("Background - extracted body data:", bodyData);

          if (bodyData) {
            // Use URL as key since devtools doesn't provide requestId
            requestBodies.set(details.url, {
              body: bodyData,
              timestamp: Date.now()
            });

            console.log("Background - stored body for URL:", details.url);
            console.log("Background - current stored bodies:", Array.from(requestBodies.keys()));

            // Clean up old entries (keep only last 50 and entries from last 30 seconds)
            const now = Date.now();
            for (const [url, data] of requestBodies.entries()) {
              if (now - data.timestamp > 30000) { // 30 seconds
                requestBodies.delete(url);
              }
            }

            // Keep only the most recent 50 entries
            if (requestBodies.size > 50) {
              const entries = Array.from(requestBodies.entries());
              entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
              requestBodies.clear();
              entries.slice(0, 50).forEach(([url, data]) => {
                requestBodies.set(url, data);
              });
            }
          }
        }
      },
      {
        urls: getAllDomainUrls()
      },
      ["requestBody"]
    );
  }

  // Send request body data to devtools when available
  runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background - received message:", request);
    if (request.type === "GET_REQUEST_BODY" && request.url) {
      const data = requestBodies.get(request.url);
      const body = data ? data.body : "";
      console.log("Background - returning body for URL:", request.url, "body:", body);
      sendResponse({ body: body });
      // Don't clean up immediately, let it expire naturally
    }
  });
}

init();
