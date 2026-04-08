import React, { useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
  atomOneDark,
  atomOneLight,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import { IconButton } from "@fluentui/react/lib/Button";

const ColoredUrl = ({ url }) => {
  const parts = [];
  try {
    const urlObj = new URL(url);

    // Protocol
    parts.push(<span key="proto" className="gxr-url-protocol">{urlObj.protocol}{"//"}</span>);

    // Host
    parts.push(<span key="host" className="gxr-url-host">{urlObj.host}</span>);

    // Path segments
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    pathSegments.forEach((seg, i) => {
      parts.push(<span key={`sep-${i}`} className="gxr-url-separator">/</span>);
      if (/^(v1\.0|beta)$/i.test(seg)) {
        parts.push(<span key={`seg-${i}`} className="gxr-url-version">{seg}</span>);
      } else {
        parts.push(<span key={`seg-${i}`} className="gxr-url-path">{seg}</span>);
      }
    });

    // Query string
    const search = urlObj.search;
    if (search) {
      parts.push(<span key="q-start" className="gxr-url-query-punctuation">?</span>);
      const params = search.slice(1).split("&");
      params.forEach((param, i) => {
        if (i > 0) {
          parts.push(<span key={`q-amp-${i}`} className="gxr-url-query-punctuation">&amp;</span>);
        }
        const eqIndex = param.indexOf("=");
        if (eqIndex >= 0) {
          parts.push(<span key={`q-key-${i}`} className="gxr-url-query-key">{decodeURIComponent(param.slice(0, eqIndex))}</span>);
          parts.push(<span key={`q-eq-${i}`} className="gxr-url-query-punctuation">=</span>);
          parts.push(<span key={`q-val-${i}`} className="gxr-url-query-value">{decodeURIComponent(param.slice(eqIndex + 1))}</span>);
        } else {
          parts.push(<span key={`q-key-${i}`} className="gxr-url-query-key">{decodeURIComponent(param)}</span>);
        }
      });
    }
  } catch {
    // Fallback for malformed URLs
    return <span style={{ color: "#abb2bf" }}>{url}</span>;
  }
  return <>{parts}</>;
};

export const CodeView = ({ request, lightUrl, snippetLanguage, batchFilter }) => {
  const [isRequestBodyExpanded, setIsRequestBodyExpanded] = useState(false);
  const [isBatchExecutionExpanded, setIsBatchExecutionExpanded] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);

  const isRest = snippetLanguage === "rest";

  let urlStyle = atomOneDark;
  if (lightUrl) {
    urlStyle = atomOneLight;
  }

  let syntaxLanguage = snippetLanguage;

  // Function to format JSON content
  const formatJsonContent = (content) => {
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    try {
      // Clean up the content first - remove extra whitespace and newlines
      const cleanContent = content.trim();
      console.log("Formatting JSON content:", cleanContent.substring(0, 100) + "...");
      
      // Try to parse as JSON
      const parsed = JSON.parse(cleanContent);
      const formatted = JSON.stringify(parsed, null, 2);
      console.log("Successfully formatted JSON");
      return formatted;
    } catch (e) {
      console.log("Not valid JSON, returning original content:", e.message);
      return content;
    }
  };

  // Function to handle batch request/response matching
  const processBatchContent = (requestBody, responseContent) => {
    console.log("=== BATCH PROCESSING DEBUG ===");
    console.log("Request body:", requestBody);
    console.log("Response content:", responseContent);
    console.log("Request URL:", request.displayRequestUrl);
    
    // Check if this is a batch endpoint
    const isBatchEndpoint = request.displayRequestUrl && request.displayRequestUrl.includes('/$batch');
    console.log("Is batch endpoint (/$batch):", isBatchEndpoint);
    
    if (!requestBody || !responseContent) {
      console.log("Missing request body or response content");
      return { requestBody, responseContent };
    }

    try {
      const requestData = JSON.parse(requestBody);
      const responseData = JSON.parse(responseContent);

      console.log("Parsed request data:", requestData);
      console.log("Parsed response data:", responseData);

      // Check if this is a batch request/response
      const hasBatchStructure = requestData.requests && responseData.responses;
      console.log("Has batch structure:", hasBatchStructure);
      
      if (isBatchEndpoint && hasBatchStructure) {
        console.log("✅ Detected batch request/response");
        console.log("Number of requests:", requestData.requests.length);
        console.log("Number of responses:", responseData.responses.length);
        
        // Create a map of responses by ID
        const responseMap = {};
        responseData.responses.forEach(response => {
          console.log("Response ID:", response.id, "Status:", response.status);
          if (response.id) {
            responseMap[response.id] = response;
          }
        });

        console.log("Response map:", responseMap);

        // Match requests with their responses
        const matchedPairs = [];
        requestData.requests.forEach(request => {
          console.log("Processing request ID:", request.id, "Method:", request.method, "URL:", request.url);
          if (request.id && responseMap[request.id]) {
            const response = responseMap[request.id];
            console.log("✅ Found matching response for request ID:", request.id);
            matchedPairs.push({
              id: request.id,
              request: request,
              response: response,
              responseBody: response.body ? JSON.stringify(response.body, null, 2) : null
            });
          } else {
            console.log("❌ No matching response found for request ID:", request.id);
          }
        });

        console.log("Final matched pairs:", matchedPairs.length);
        
        return { 
          isBatch: true, 
          matchedPairs: matchedPairs,
          originalRequest: requestBody,
          originalResponse: responseContent
        };
      } else {
        console.log("❌ Not a batch request/response");
        console.log("Is batch endpoint:", isBatchEndpoint);
        console.log("Has requests:", !!requestData.requests);
        console.log("Has responses:", !!responseData.responses);
      }
    } catch (e) {
      console.log("❌ Error processing batch content:", e);
      console.log("Error parsing JSON. Request body type:", typeof requestBody);
      console.log("Response content type:", typeof responseContent);
    }

    console.log("=== END BATCH PROCESSING DEBUG ===");
    return { requestBody, responseContent };
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log("Copied to clipboard:", text);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const toggleRequestBody = () => {
    setIsRequestBodyExpanded(!isRequestBodyExpanded);
  };

  const toggleBatchExecution = () => {
    setIsBatchExecutionExpanded(!isBatchExecutionExpanded);
  };

  // Process batch content if applicable
  const batchData = processBatchContent(request.requestBody, request.responseContent);

  return (
    <div>
      {request.displayRequestUrl && request.displayRequestUrl.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
            {((request.requestBody && request.requestBody.length > 0) || (request.responseContent && request.responseContent.length > 0)) && (
              <IconButton
                iconProps={{ iconName: isRequestBodyExpanded ? "ChevronDown" : "ChevronRight" }}
                title={isRequestBodyExpanded ? "Collapse request/response" : "Expand request/response"}
                onClick={toggleRequestBody}
                onMouseEnter={() => setHoveredButton('expand')}
                onMouseLeave={() => setHoveredButton(null)}
                styles={{
                  root: {
                    minWidth: "24px",
                    width: "24px",
                    height: "24px",
                    marginRight: "8px",
                    color: lightUrl ? "#333" : "#fff",
                    backgroundColor: hoveredButton === 'expand'
                      ? (lightUrl ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)")
                      : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease"
                  },
                  rootHovered: {
                    backgroundColor: lightUrl ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)"
                  }
                }}
              />
            )}
            <div style={{ position: "relative", flex: 1 }}>
              <SyntaxHighlighter
                language="jboss-cli"
                style={urlStyle}
                wrapLongLines={true}
                customStyle={{
                  borderRadius: "8px",
                  padding: "12px",
                  paddingRight: "50px",
                  margin: 0
                }}
              >
                {request.displayRequestUrl}
              </SyntaxHighlighter>
              <IconButton
                iconProps={{ iconName: "Copy" }}
                title="Copy URL to clipboard"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyToClipboard(request.displayRequestUrl);
                }}
                onMouseEnter={() => setHoveredButton('url-copy')}
                onMouseLeave={() => setHoveredButton(null)}
                styles={{
                  root: {
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    backgroundColor: hoveredButton === 'url-copy'
                      ? (lightUrl ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.25)")
                      : (lightUrl ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)"),
                    color: lightUrl ? "#333" : "#fff",
                    border: hoveredButton === 'url-copy'
                      ? (lightUrl ? "1px solid rgba(0, 0, 0, 0.2)" : "1px solid rgba(255, 255, 255, 0.3)")
                      : "1px solid transparent",
                    borderRadius: "4px",
                    padding: "4px",
                    cursor: "pointer",
                    minWidth: "32px",
                    width: "32px",
                    height: "32px",
                    transition: "all 0.2s ease",
                    boxShadow: hoveredButton === 'url-copy'
                      ? "0 2px 4px rgba(0, 0, 0, 0.1)"
                      : "none"
                  }
                }}
              />
            </div>
          </div>

          {isRequestBodyExpanded && ((request.requestBody && request.requestBody.length > 0) || (request.responseContent && request.responseContent.length > 0)) && (
            <div style={{
              border: "2px solid rgba(0, 0, 0, 0.2)",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "10px",
              backgroundColor: "rgba(0, 0, 0, 0.02)"
            }}>
              {batchData.isBatch ? (
                // Special handling for batch requests
                <div>
                  <div style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "#333",
                    marginBottom: "16px"
                  }}>
                    Batch Request/Response Pairs
                  </div>
                  {(batchFilter ? batchData.matchedPairs.filter((pair) => batchFilter(pair.request.method, pair.request.url)) : batchData.matchedPairs).map((pair, index) => (
                    <div key={pair.id} style={{
                      border: "1px solid rgba(0, 0, 0, 0.1)",
                      borderRadius: "6px",
                      padding: "12px",
                      marginBottom: index < batchData.matchedPairs.length - 1 ? "16px" : "0",
                      backgroundColor: "rgba(255, 255, 255, 0.5)"
                    }}>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#666",
                        marginBottom: "8px"
                      }}>
                        Request ID: {pair.id}
                      </div>
                      
                      {/* Individual Request */}
                      <div style={{ marginBottom: "12px" }}>
                        <div style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#333",
                          marginBottom: "6px"
                        }}>
                          Request: {pair.request.method} {pair.request.url}
                        </div>
                        <div style={{ position: "relative" }}>
                          <SyntaxHighlighter
                            language="json"
                            style={atomOneDark}
                            wrapLongLines={true}
                            customStyle={{
                              borderRadius: "6px",
                              padding: "8px",
                              paddingRight: "40px",
                              fontSize: "12px"
                            }}
                          >
                            {formatJsonContent(JSON.stringify(pair.request, null, 2))}
                          </SyntaxHighlighter>
                          <IconButton
                            iconProps={{ iconName: "Copy" }}
                            title="Copy request to clipboard"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              copyToClipboard(JSON.stringify(pair.request, null, 2));
                            }}
                            onMouseEnter={() => setHoveredButton(`batch-req-${index}`)}
                            onMouseLeave={() => setHoveredButton(null)}
                            styles={{
                              root: {
                                position: "absolute",
                                top: "6px",
                                right: "6px",
                                backgroundColor: hoveredButton === `batch-req-${index}`
                                  ? "rgba(255, 255, 255, 0.25)"
                                  : "rgba(255, 255, 255, 0.1)",
                                color: "#fff",
                                border: "1px solid transparent",
                                borderRadius: "3px",
                                padding: "2px",
                                cursor: "pointer",
                                minWidth: "24px",
                                width: "24px",
                                height: "24px",
                                fontSize: "10px"
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Individual Response */}
                      {pair.responseBody && (
                        <div>
                          <div style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "#333",
                            marginBottom: "6px"
                          }}>
                            Response (Status: {pair.response.status})
                          </div>
                          <div style={{ position: "relative" }}>
                            <SyntaxHighlighter
                              language="json"
                              style={atomOneDark}
                              wrapLongLines={true}
                              customStyle={{
                                borderRadius: "6px",
                                padding: "8px",
                                paddingRight: "40px",
                                fontSize: "12px"
                              }}
                            >
                              {pair.responseBody}
                            </SyntaxHighlighter>
                            <IconButton
                              iconProps={{ iconName: "Copy" }}
                              title="Copy response to clipboard"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(pair.responseBody);
                              }}
                              onMouseEnter={() => setHoveredButton(`batch-resp-${index}`)}
                              onMouseLeave={() => setHoveredButton(null)}
                              styles={{
                                root: {
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                  backgroundColor: hoveredButton === `batch-resp-${index}`
                                    ? "rgba(255, 255, 255, 0.25)"
                                    : "rgba(255, 255, 255, 0.1)",
                                  color: "#fff",
                                  border: "1px solid transparent",
                                  borderRadius: "3px",
                                  padding: "2px",
                                  cursor: "pointer",
                                  minWidth: "24px",
                                  width: "24px",
                                  height: "24px",
                                  fontSize: "10px"
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Normal request/response handling
                <div>
                  {request.requestBody && request.requestBody.length > 0 && (
                    <div style={{ marginBottom: request.responseContent && request.responseContent.length > 0 ? "15px" : "0" }}>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#333",
                        marginBottom: "8px"
                      }}>
                        Request
                      </div>
                      <div style={{ position: "relative" }}>
                        <SyntaxHighlighter
                          language="json"
                          style={atomOneDark}
                          wrapLongLines={true}
                          customStyle={{
                            borderRadius: "8px",
                            padding: "12px",
                            paddingRight: "50px"
                          }}
                        >
                          {formatJsonContent(request.requestBody)}
                        </SyntaxHighlighter>
                        <IconButton
                          iconProps={{ iconName: "Copy" }}
                          title="Copy request body to clipboard"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyToClipboard(request.requestBody);
                          }}
                          onMouseEnter={() => setHoveredButton('body-copy')}
                          onMouseLeave={() => setHoveredButton(null)}
                          styles={{
                            root: {
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              backgroundColor: hoveredButton === 'body-copy'
                                ? "rgba(255, 255, 255, 0.25)"
                                : "rgba(255, 255, 255, 0.1)",
                              color: "#fff",
                              border: hoveredButton === 'body-copy'
                                ? "1px solid rgba(255, 255, 255, 0.4)"
                                : "1px solid transparent",
                              borderRadius: "4px",
                              padding: "4px",
                              cursor: "pointer",
                              minWidth: "32px",
                              width: "32px",
                              height: "32px",
                              transition: "all 0.2s ease",
                              boxShadow: hoveredButton === 'body-copy'
                                ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                                : "none"
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {request.responseContent && request.responseContent.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#333",
                        marginBottom: "8px"
                      }}>
                        Response
                      </div>
                      <div style={{ position: "relative" }}>
                        <SyntaxHighlighter
                          language="json"
                          style={atomOneDark}
                          wrapLongLines={true}
                          customStyle={{
                            borderRadius: "8px",
                            padding: "12px",
                            paddingRight: "50px"
                          }}
                        >
                          {formatJsonContent(request.responseContent)}
                        </SyntaxHighlighter>
                        <IconButton
                          iconProps={{ iconName: "Copy" }}
                          title="Copy response to clipboard"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyToClipboard(request.responseContent);
                          }}
                          onMouseEnter={() => setHoveredButton('response-copy')}
                          onMouseLeave={() => setHoveredButton(null)}
                          styles={{
                            root: {
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              backgroundColor: hoveredButton === 'response-copy'
                                ? "rgba(255, 255, 255, 0.25)"
                                : "rgba(255, 255, 255, 0.1)",
                              color: "#fff",
                              border: hoveredButton === 'response-copy'
                                ? "1px solid rgba(255, 255, 255, 0.4)"
                                : "1px solid transparent",
                              borderRadius: "4px",
                              padding: "4px",
                              cursor: "pointer",
                              minWidth: "32px",
                              width: "32px",
                              height: "32px",
                              transition: "all 0.2s ease",
                              boxShadow: hoveredButton === 'response-copy'
                                ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                                : "none"
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {request.code && request.code.length > 0 && (
        request.batchCodeSnippets && request.batchCodeSnippets.length > 0 ? (
          <div style={{ marginBottom: "15px" }}>
            {/* Keep batch execution code available, but collapsed by default so focus stays on per-request snippets. */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: isBatchExecutionExpanded ? "8px" : "0" }}>
              <IconButton
                iconProps={{ iconName: isBatchExecutionExpanded ? "ChevronDown" : "ChevronRight" }}
                title={isBatchExecutionExpanded ? "Collapse batch execution snippet" : "Expand batch execution snippet"}
                onClick={toggleBatchExecution}
                onMouseEnter={() => setHoveredButton('batch-execution-toggle')}
                onMouseLeave={() => setHoveredButton(null)}
                styles={{
                  root: {
                    minWidth: "24px",
                    width: "24px",
                    height: "24px",
                    marginRight: "8px",
                    color: lightUrl ? "#333" : "#fff",
                    backgroundColor: hoveredButton === 'batch-execution-toggle'
                      ? (lightUrl ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)")
                      : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease"
                  }
                }}
              />
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>
                Batch Execution Snippet ({snippetLanguage})
              </div>
            </div>

            {isBatchExecutionExpanded && (
              <div style={{ position: "relative" }}>
                <SyntaxHighlighter
                  language={syntaxLanguage}
                  style={atomOneDark}
                  wrapLongLines={true}
                  customStyle={{
                    borderRadius: "8px",
                    padding: "12px",
                    paddingRight: "50px"
                  }}
                >
                  {request.code}
                </SyntaxHighlighter>
                <IconButton
                  iconProps={{ iconName: "Copy" }}
                  title="Copy batch execution code to clipboard"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyToClipboard(request.code);
                  }}
                  onMouseEnter={() => setHoveredButton('code-copy')}
                  onMouseLeave={() => setHoveredButton(null)}
                  styles={{
                    root: {
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      backgroundColor: hoveredButton === 'code-copy'
                        ? "rgba(255, 255, 255, 0.25)"
                        : "rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      border: hoveredButton === 'code-copy'
                        ? "1px solid rgba(255, 255, 255, 0.4)"
                        : "1px solid transparent",
                      borderRadius: "4px",
                      padding: "4px",
                      cursor: "pointer",
                      minWidth: "32px",
                      width: "32px",
                      height: "32px",
                      transition: "all 0.2s ease",
                      boxShadow: hoveredButton === 'code-copy'
                        ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                        : "none"
                    }
                  }}
                />
              </div>
            )}
          </div>
        ) : isRest && request.code ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "600",
              lineHeight: "20px",
              backgroundColor: "#0078d4",
              color: "#fff",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              {request.displayRequestUrl ? request.displayRequestUrl.split(" ")[0] : ""}
            </span>
            <div style={{ position: "relative", flex: 1 }}>
              <div className="gxr-rest-url">
                <ColoredUrl url={request.code} />
              </div>
              <IconButton
                iconProps={{ iconName: "Copy" }}
                title="Copy URL to clipboard"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyToClipboard(request.code);
                }}
                onMouseEnter={() => setHoveredButton('code-copy')}
                onMouseLeave={() => setHoveredButton(null)}
                styles={{
                  root: {
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    backgroundColor: hoveredButton === 'code-copy'
                      ? "rgba(255, 255, 255, 0.25)"
                      : "rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    border: hoveredButton === 'code-copy'
                      ? "1px solid rgba(255, 255, 255, 0.4)"
                      : "1px solid transparent",
                    borderRadius: "4px",
                    padding: "4px",
                    cursor: "pointer",
                    minWidth: "32px",
                    width: "32px",
                    height: "32px",
                    transition: "all 0.2s ease",
                    boxShadow: hoveredButton === 'code-copy'
                      ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                      : "none"
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <SyntaxHighlighter
              language={syntaxLanguage}
              style={atomOneDark}
              wrapLongLines={true}
              customStyle={{
                borderRadius: "8px",
                padding: "12px",
                paddingRight: "50px"
              }}
            >
              {request.code}
            </SyntaxHighlighter>
            <IconButton
              iconProps={{ iconName: "Copy" }}
              title="Copy code to clipboard"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                copyToClipboard(request.code);
              }}
              onMouseEnter={() => setHoveredButton('code-copy')}
              onMouseLeave={() => setHoveredButton(null)}
              styles={{
                root: {
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  backgroundColor: hoveredButton === 'code-copy'
                    ? "rgba(255, 255, 255, 0.25)"
                    : "rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  border: hoveredButton === 'code-copy'
                    ? "1px solid rgba(255, 255, 255, 0.4)"
                    : "1px solid transparent",
                  borderRadius: "4px",
                  padding: "4px",
                  cursor: "pointer",
                  minWidth: "32px",
                  width: "32px",
                  height: "32px",
                  transition: "all 0.2s ease",
                  boxShadow: hoveredButton === 'code-copy'
                    ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                    : "none"
                }
              }}
            />
          </div>
        )
      )}

      {/* Batch code snippets - show individual code blocks for each request in the batch */}
      {request.batchCodeSnippets && request.batchCodeSnippets.length > 0 && (
        <div style={{ marginTop: "15px" }}>
          <div style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "#333",
            marginBottom: "16px"
          }}>
            Individual Request Code Snippets
          </div>
          {(batchFilter ? request.batchCodeSnippets.filter((s) => batchFilter(s.method, s.url)) : request.batchCodeSnippets).map((snippet, index) => (
            <div key={snippet.id} style={{
              marginBottom: index < request.batchCodeSnippets.length - 1 ? "20px" : "0"
            }}>
              {isRest ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    lineHeight: "20px",
                    backgroundColor: "#0078d4",
                    color: "#fff",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    {snippet.method}
                  </span>
                  <div style={{ position: "relative", flex: 1 }}>
                    <div className="gxr-rest-url">
                      <ColoredUrl url={snippet.code} />
                    </div>
                    <IconButton
                      iconProps={{ iconName: "Copy" }}
                      title="Copy URL to clipboard"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        copyToClipboard(snippet.code);
                      }}
                      onMouseEnter={() => setHoveredButton(`batch-code-${index}`)}
                      onMouseLeave={() => setHoveredButton(null)}
                      styles={{
                        root: {
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          backgroundColor: hoveredButton === `batch-code-${index}`
                            ? "rgba(255, 255, 255, 0.25)"
                            : "rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                          border: hoveredButton === `batch-code-${index}`
                            ? "1px solid rgba(255, 255, 255, 0.4)"
                            : "1px solid transparent",
                          borderRadius: "4px",
                          padding: "4px",
                          cursor: "pointer",
                          minWidth: "32px",
                          width: "32px",
                          height: "32px",
                          transition: "all 0.2s ease",
                          boxShadow: hoveredButton === `batch-code-${index}`
                            ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                            : "none"
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
              <div style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#666",
                marginBottom: "8px"
              }}>
                Request ID: {snippet.id} - {snippet.method} {snippet.url}
              </div>
              <div style={{ position: "relative" }}>
                <SyntaxHighlighter
                  language={syntaxLanguage}
                  style={atomOneDark}
                  wrapLongLines={true}
                  customStyle={{
                    borderRadius: "8px",
                    padding: "12px",
                    paddingRight: "50px"
                  }}
                >
                  {snippet.code}
                </SyntaxHighlighter>
                <IconButton
                  iconProps={{ iconName: "Copy" }}
                  title="Copy individual code to clipboard"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyToClipboard(snippet.code);
                  }}
                  onMouseEnter={() => setHoveredButton(`batch-code-${index}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  styles={{
                    root: {
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      backgroundColor: hoveredButton === `batch-code-${index}`
                        ? "rgba(255, 255, 255, 0.25)"
                        : "rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      border: hoveredButton === `batch-code-${index}`
                        ? "1px solid rgba(255, 255, 255, 0.4)"
                        : "1px solid transparent",
                      borderRadius: "4px",
                      padding: "4px",
                      cursor: "pointer",
                      minWidth: "32px",
                      width: "32px",
                      height: "32px",
                      transition: "all 0.2s ease",
                      boxShadow: hoveredButton === `batch-code-${index}`
                        ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                        : "none"
                    }
                  }}
                />
              </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
