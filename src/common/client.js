import { parseGraphUrl, GRAPH_DOMAINS, isUltraXRayDomain } from "./domains.js";
import { runtime } from "./browserApi.js";

const devxEndPoint =
  "https://devxapi-func-prod-eastus.azurewebsites.net/api/graphexplorersnippets";

function formatPowerShellValue(val, indent) {
  if (val === null) return "$null";
  if (typeof val === "boolean") return val ? "$true" : "$false";
  if (typeof val === "number") return String(val);

  if (Array.isArray(val)) {
    if (val.length === 0) return "@()";
    const items = val.map(
      (v) => `${indent}\t${formatPowerShellValue(v, indent + "\t")}`
    );
    return `@(\n${items.join("\n")}\n${indent})`;
  }

  if (typeof val === "object") {
    const entries = Object.entries(val).map(
      ([k, v]) => `${indent}\t"${k}" = ${formatPowerShellValue(v, indent + "\t")}`
    );
    return `@{\n${entries.join("\n")}\n${indent}}`;
  }

  const escaped = String(val).replace(/[`$"]/g, "`$&");
  return `"${escaped}"`;
}

function buildBodyBlock(body) {
  const lines = [];
  lines.push("$params = @{");

  try {
    const parsed = JSON.parse(body);
    for (const [key, value] of Object.entries(parsed)) {
      lines.push(`\t"${key}" = ${formatPowerShellValue(value, "\t")}`);
    }
  } catch {
    lines.push(`\t# Raw body`);
    body.split('\n').forEach(line => lines.push(`\t# ${line}`));
  }

  lines.push("}");
  return lines;
}

function hasConsistencyLevelHeader(headers) {
  if (!headers) {
    return false;
  }

  if (Array.isArray(headers)) {
    return headers.some(
      (header) =>
        header &&
        typeof header.name === "string" &&
        header.name.toLowerCase() === "consistencylevel"
    );
  }

  if (typeof headers === "object") {
    return Object.keys(headers).some(
      (headerName) => headerName.toLowerCase() === "consistencylevel"
    );
  }

  return false;
}

function generateLocalPowerShellSnippet(method, url, body, options = {}) {
  const { host, path } = parseGraphUrl(url);
  // Strip any leading slashes from path before joining to avoid double slashes (e.g. "https://host//v1.0/...")
  const fullUrl = `https://${host}/${path.replace(/^\/+/, '')}`;
  // Escape $ signs in the URL with a backtick so PowerShell does not treat them as variable expansions inside double-quoted strings
  const escapedUrl = fullUrl.replace(/\$/g, '`$');
  const methodUpper = method.toUpperCase();
  const includeConsistencyLevelHeader =
    methodUpper === "GET" && options.includeConsistencyLevelHeader;
  const hasBody = body && body.trim().length > 0;

  const lines = [];

  if (hasBody) {
    lines.push(...buildBodyBlock(body));
    lines.push("");
  }

  let cmd = `Invoke-MgGraphRequest -Method ${methodUpper} -Uri "${escapedUrl}"`;
  // Keep ConsistencyLevel behavior from captured GET requests for advanced query endpoints.
  if (includeConsistencyLevelHeader) {
    cmd += ` -Headers @{ "ConsistencyLevel" = "eventual" }`;
  }
  if (hasBody) {
    cmd += ` -Body ($params | ConvertTo-Json -Depth 10) -ContentType "application/json"`;
  }
  lines.push(cmd);

  return lines.join("\n");
}

async function getSnippetFromDevX(snippetLanguage, method, url, body, options = {}) {
  console.log("Get code snippet from DevX:", url, method);

  if (isUltraXRayDomain(url)) {
    console.log("Skipping DevX call for Ultra X-Ray domain:", url);
    return null;
  }

  const bodyText = body ?? "";
  const preferLocalPowerShell =
    snippetLanguage === "powershell" && options.preferLocalPowerShell === true;
  const devxOnly = options.devxOnly === true;

  // For local-first UX, return PowerShell immediately and let caller optionally fetch DevX in a second pass.
  if (preferLocalPowerShell) {
    return generateLocalPowerShellSnippet(method, url, bodyText, options);
  }

  const { path: parsedPath, host } = parseGraphUrl(url);
  const path = encodeURI(parsedPath);
  let payloadHeaders = `Host: ${host}\r\nContent-Type: application/json`;
  // Forward ConsistencyLevel to DevX when present so generated snippets can include equivalent behavior.
  if (method.toUpperCase() === "GET" && options.includeConsistencyLevelHeader) {
    payloadHeaders += `\r\nConsistencyLevel: eventual`;
  }
  const payload = `${method} ${path} HTTP/1.1\r\n${payloadHeaders}\r\n\r\n${bodyText}`;

  const devxSnippetUri = buildDevxUri(snippetLanguage);

  try {
    const response = await fetch(devxSnippetUri, {
      headers: { "content-type": "application/http" },
      method: "POST",
      body: payload,
    });

    if (response.ok) {
      return await response.text();
    }

    const errorText = await response.text();
    console.log(`DevXError: ${response.status} ${response.statusText} for ${method} ${url} - Response: ${errorText}`);
  } catch (error) {
    console.log(`DevXError: Network/Request error for ${method} ${url} - ${error.message || error}`, error);
  }

  // Fall back to local generation for PowerShell when DevX fails
  if (snippetLanguage === "powershell" && !devxOnly) {
    console.log("Falling back to local PowerShell snippet generation");
    return generateLocalPowerShellSnippet(method, url, bodyText, options);
  }

  return null;
}

function buildDevxUri(snippetLanguage) {
  if (snippetLanguage === "c#") {
    return devxEndPoint;
  }

  const langParam = `?lang=${snippetLanguage}`;

  if (["go", "powershell", "python"].includes(snippetLanguage)) {
    return `${devxEndPoint}${langParam}&generation=openapi`;
  }

  return `${devxEndPoint}${langParam}`;
}

// Preserve the original function name used throughout the codebase
const getPowershellCmd = getSnippetFromDevX;

const getRequestBody = async function (request) {
  let requestBody = "";
  
  console.log("getRequestBody - request object:", request);
  console.log("getRequestBody - request.method:", request.method);
  console.log("getRequestBody - request.url:", request.url);
  
  // First, check if the request object directly has a body property (seems to be the case!)
  if (request.body) {
    if (typeof request.body === 'string') {
      requestBody = request.body;
    } else {
      requestBody = JSON.stringify(request.body);
    }
    console.log("getRequestBody - found body in request.body:", requestBody);
    return requestBody;
  }
  
  // Second, try to get from the standard devtools API (limited access)
  if (request.postData && request.postData.text) {
    requestBody = request.postData.text;
    console.log("getRequestBody - found body in postData:", requestBody);
    return requestBody;
  }
  
  // Try using getContent() method if available (for DevTools Network requests)
  // IMPORTANT: This should only get REQUEST content, not response content
  if (!requestBody && request._harEntry && typeof request._harEntry.getContent === 'function') {
    console.log("getRequestBody - trying getContent() method on harEntry for REQUEST body");
    try {
      const content = await new Promise((resolve) => {
        request._harEntry.getContent((content, encoding) => {
          console.log("getRequestBody - getContent returned:", content, encoding);
          resolve(content);
        });
      });
      
      // Only use this if it's actually request content (POST/PUT/PATCH methods typically have bodies)
      if (content && ['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
        requestBody = content;
        console.log("getRequestBody - found REQUEST body from getContent:", requestBody);
        return requestBody;
      } else {
        console.log("getRequestBody - ignoring getContent result for GET/DELETE request or empty content");
      }
    } catch (error) {
      console.log("getRequestBody - getContent failed:", error);
    }
  }
  
  // If no body found, try to get from background script using URL
  if (!requestBody && request.url) {
    console.log("getRequestBody - trying background script with URL:", request.url);
    try {
      // Generate URLs to try based on standard Graph domains
      const urlsToTry = [request.url];
      
      // Add variations for standard Graph endpoints
      GRAPH_DOMAINS.STANDARD.forEach(domain => {
        urlsToTry.push(`${domain}/v1.0${request.url}`);
        urlsToTry.push(`${domain}/beta${request.url}`);
      });
      
      for (const url of urlsToTry) {
        const response = await runtime.sendMessage({
          type: "GET_REQUEST_BODY",
          url: url
        });
        console.log("getRequestBody - background script response for", url, ":", response);
        if (response && response.body) {
          requestBody = response.body;
          console.log("getRequestBody - found body from background script:", requestBody);
          return requestBody;
        }
      }
    } catch (error) {
      console.log("Could not get request body from background script:", error);
    }
  }
  
  console.log("getRequestBody - final result (should only be REQUEST body):", requestBody);
  return requestBody;
};

const getResponseContent = async function (harEntry) {
  let responseContent = "";
  
  console.log("getResponseContent - harEntry:", harEntry);
  console.log("getResponseContent - harEntry type:", typeof harEntry);
  
  // Try to get response content from harEntry
  if (harEntry && harEntry.response) {
    console.log("getResponseContent - response object:", harEntry.response);
    console.log("getResponseContent - response status:", harEntry.response.status);
    console.log("getResponseContent - response headers:", harEntry.response.headers);
    console.log("getResponseContent - response content object:", harEntry.response.content);
    
    // Check if response has content directly in the content.text property
    if (harEntry.response.content && harEntry.response.content.text !== undefined) {
      responseContent = harEntry.response.content.text;
      console.log("getResponseContent - raw content.text:", responseContent, "length:", responseContent.length);
      
      // If it's base64 encoded, decode it
      if (harEntry.response.content.encoding === 'base64') {
        try {
          responseContent = atob(harEntry.response.content.text);
          console.log("getResponseContent - decoded base64 content:", responseContent);
        } catch (e) {
          console.log("Failed to decode base64 content:", e);
          // Keep the original text if decoding fails
        }
      }
      
      console.log("getResponseContent - found content in response.content.text:", responseContent);
      if (responseContent && responseContent.length > 0) {
        return responseContent;
      }
    }
    
    // Try using getResponseBody() method if available (this is different from getContent)
    if (typeof harEntry.getResponseBody === 'function') {
      console.log("getResponseContent - trying getResponseBody() method");
      try {
        const content = await new Promise((resolve) => {
          harEntry.getResponseBody((content, encoding) => {
            console.log("getResponseContent - getResponseBody returned:", content, encoding);
            resolve(content);
          });
        });
        if (content) {
          responseContent = content;
          console.log("getResponseContent - found content from getResponseBody:", responseContent);
          return responseContent;
        }
      } catch (error) {
        console.log("getResponseContent - getResponseBody failed:", error);
      }
    }
    
    // Try using getContent() method which should get the response content for completed requests
    if (typeof harEntry.getContent === 'function') {
      console.log("getResponseContent - trying getContent() method for response content");
      try {
        const content = await new Promise((resolve) => {
          harEntry.getContent((content, encoding) => {
            console.log("getResponseContent - getContent returned:", content, "encoding:", encoding, "content length:", content ? content.length : 0);
            resolve(content);
          });
        });
        if (content && content.length > 0) {
          responseContent = content;
          console.log("getResponseContent - found content from getContent:", responseContent.substring(0, 200) + "...");
          return responseContent;
        }
      } catch (error) {
        console.log("getResponseContent - getContent failed:", error);
      }
    }
    
    // Final attempt: check if there's any content object with size > 0
    if (harEntry.response.content && harEntry.response.content.size > 0) {
      console.log("getResponseContent - response has content with size:", harEntry.response.content.size);
      // Sometimes the content is there but text property is empty string
      if (harEntry.response.content.text === "") {
        console.log("getResponseContent - content.text is empty string but size > 0, this might be an issue with content retrieval");
      }
    }
  }
  
  console.log("getResponseContent - final result:", responseContent);
  return responseContent;
};

const getBatchCodeSnippets = async function (
  snippetLanguage,
  requestBody,
  baseUrl,
  options = {}
) {
  console.log("Generating code snippets for batch request");
  
  if (!requestBody) {
    return [];
  }
  
  try {
    const batchData = JSON.parse(requestBody);
    if (!batchData.requests) {
      return [];
    }
    
    const codeSnippets = [];
    
    for (const request of batchData.requests) {
      console.log("Generating snippet for batch request:", request.id, request.method, request.url);
      
      // Construct full URL for the individual request
      const fullUrl = `${baseUrl}${request.url}`;
      
      // Get the body for this individual request
      const requestBodyText = request.body ? JSON.stringify(request.body) : "";
      const includeConsistencyLevelHeader = hasConsistencyLevelHeader(request.headers);
      
      // Generate code snippet for this individual request
      const code = await getPowershellCmd(
        snippetLanguage,
        request.method,
        fullUrl,
        requestBodyText,
        { ...options, includeConsistencyLevelHeader }
      );
      
      if (code) {
        codeSnippets.push({
          id: request.id,
          method: request.method,
          url: request.url,
          code: code
        });
      }
    }
    
    console.log("Generated", codeSnippets.length, "code snippets for batch request");
    return codeSnippets;
  } catch (error) {
    console.log("Error generating batch code snippets:", error);
    return [];
  }
};

const getCodeView = async function (
  snippetLanguage,
  request,
  version,
  harEntry = null,
  options = {}
) {
  if (["OPTIONS"].includes(request.method)) {
    return null;
  }
  console.log("GetCodeView", snippetLanguage, request, harEntry);
  const requestBody = await getRequestBody(request);
  const responseContent = harEntry ? await getResponseContent(harEntry) : "";
  const includeConsistencyLevelHeader = hasConsistencyLevelHeader(request.headers);
  
  let code = null;
  let batchCodeSnippets = [];
  
  // Check if this is a batch request
  if (request.url.includes("/$batch")) {
    console.log("Processing batch request for code generation");
    // Extract base URL for batch requests
    const baseUrl = request.url.split("/$batch")[0];
    batchCodeSnippets = await getBatchCodeSnippets(
      snippetLanguage,
      requestBody,
      baseUrl,
      options
    );
    
    // Also generate a code snippet for the main batch request
    code = await getPowershellCmd(
      snippetLanguage,
      request.method,
      version + request.url,
      requestBody,
      { ...options, includeConsistencyLevelHeader }
    );
  } else {
    // Regular single request
    code = await getPowershellCmd(
      snippetLanguage,
      request.method,
      version + request.url,
      requestBody,
      { ...options, includeConsistencyLevelHeader }
    );
  }
  
  const codeView = {
    displayRequestUrl: request.method + " " + request.url,
    requestBody: requestBody,
    responseContent: responseContent,
    code: code,
    batchCodeSnippets: batchCodeSnippets, // Add batch code snippets to the result
  };
  console.log("CodeView", codeView);
  return codeView;
};
export { getPowershellCmd, getRequestBody, getResponseContent, getCodeView, getBatchCodeSnippets, generateLocalPowerShellSnippet };
