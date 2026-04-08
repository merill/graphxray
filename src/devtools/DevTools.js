import React from "react";
import "./DevTools.css";
import { CodeView } from "../components/CodeView";
import { AppHeader } from "../components/AppHeader";
import { FontSizes } from "@fluentui/theme";
import { getTheme } from "@fluentui/react";
import { getCodeView } from "../common/client.js";
import { isAllowedDomain } from "../common/domains.js";
import { Dropdown } from "@fluentui/react/lib/Dropdown";
import { Toggle } from "@fluentui/react/lib/Toggle";
import { IconButton } from "@fluentui/react/lib/Button";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { SearchBox } from "@fluentui/react/lib/SearchBox";
import DevToolsCommandBar from "../components/DevToolsCommandBar";
import { Layer } from "@fluentui/react/lib/Layer";

const theme = getTheme();

const dropdownStyles = {
  dropdown: { width: 340 },
};

const options = [
  { key: "rest", text: "REST", fileExt: "http" },
  { key: "powershell", text: "PowerShell", fileExt: "ps1" },
  { key: "powershell-local", text: "PowerShell (Invoke-MgGraphRequest)", fileExt: "ps1" },
  { key: "python", text: "Python", fileExt: "py" },
  { key: "c#", text: "C#", fileExt: "cs" },
  { key: "javascript", text: "JavaScript", fileExt: "js" },
  { key: "java", text: "Java", fileExt: "java" },
  { key: "objective-c", text: "Objective-C", fileExt: "c" },
  { key: "go", text: "Go", fileExt: "go" },  
];

class DevTools extends React.Component {
  constructor() {
    super();
    // Load ultraXRayMode from localStorage, default to false
    const savedUltraXRayMode = localStorage.getItem('graphxray-ultraXRayMode');
    const ultraXRayMode = savedUltraXRayMode ? JSON.parse(savedUltraXRayMode) : false;
    
    this.state = {
      stack: [],
      snippetLanguage: "powershell",
      ultraXRayMode: ultraXRayMode,
      filterText: "",
      selectedMethods: new Set(),
      selectedResources: new Set(),
      selectedDomains: new Set(),
      filtersExpanded: true,
    };
  }

  componentDidMount() {
    // Add listener when component mounts
    this.addListener();
    this.addListenerGraph();
  }

  clearStack = () => {
    this.setState({ stack: [] });
  };

  saveScript = () => {
    const script = this.getSaveScriptContent();
    const languageOpt = options.filter((opt) => {
      return opt.key === this.state.snippetLanguage;
    });
    const fileName = "GraphXRaySession." + languageOpt[0].fileExt;
    this.downloadFile(script, fileName);
  };

  copyScript = () => {
    const script = this.getSaveScriptContent();
    navigator.clipboard.writeText(script);
  };

  getSaveScriptContent() {
    let script = "";
    this.state.stack.forEach((request) => {
      if (request.code) {
        script += "\n\n" + request.code;
      }
    });
    return script;
  }

  downloadFile(content, filename) {
    const element = document.createElement("a");
    const file = new Blob([content], {
      type: "text/plain",
    });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
  }

  addListenerGraph() {
    if (!window.chrome.webview) {
      return;
    }
    window.chrome.webview.addEventListener("message", (event) => {
      console.log("Got message from host!");
      console.log(event.data);
      const msg = JSON.parse(event.data);
      if (msg.eventName === "GraphCall") {
        console.log("Showing graph call.");
        this.showRequest(msg);
      }
    });
  }

  async addRequestToStack(request, version, harEntry = null) {
    console.log("DevTools - addRequestToStack called with:", request, version, harEntry);
    if (this.state.snippetLanguage === "powershell" || this.state.snippetLanguage === "powershell-local") {
      const requestKey = `${Date.now()}-${Math.random()}`;

      // Render local PowerShell immediately so users always get a snippet without waiting on network calls.
      const localCodeView = await getCodeView(
        this.state.snippetLanguage,
        request,
        version,
        harEntry,
        { preferLocalPowerShell: true }
      );
      console.log("DevTools - local getCodeView returned:", localCodeView);

      if (!localCodeView) {
        return;
      }

      localCodeView.__requestKey = requestKey;
      this.setState((prevState) => ({ stack: [...prevState.stack, localCodeView] }));

      // For powershell-local, skip DevX upgrade
      if (this.state.snippetLanguage === "powershell-local") {
        return;
      }

      // Try to upgrade to server-generated snippets; keep local content if DevX doesn't return valid code.
      const serverCodeView = await getCodeView(
        this.state.snippetLanguage,
        request,
        version,
        harEntry,
        { devxOnly: true }
      );
      console.log("DevTools - server getCodeView returned:", serverCodeView);

      if (!serverCodeView || !serverCodeView.code || !serverCodeView.code.trim()) {
        return;
      }

      serverCodeView.__requestKey = requestKey;

      this.setState((prevState) => ({
        stack: prevState.stack.map((item) => {
          if (item.__requestKey !== requestKey) {
            return item;
          }

          const localBatch = item.batchCodeSnippets || [];
          const serverBatch = serverCodeView.batchCodeSnippets || [];
          const serverBatchMap = new Map(serverBatch.map((snippet) => [snippet.id, snippet]));

          // Replace individual batch snippets only when DevX provided a valid snippet for that request.
          const mergedBatchCodeSnippets = localBatch.map((localSnippet) => {
            const serverSnippet = serverBatchMap.get(localSnippet.id);
            if (serverSnippet && serverSnippet.code && serverSnippet.code.trim()) {
              return serverSnippet;
            }
            return localSnippet;
          });

          return {
            ...item,
            ...serverCodeView,
            __requestKey: requestKey,
            batchCodeSnippets: mergedBatchCodeSnippets,
          };
        }),
      }));

      return;
    }

    const codeView = await getCodeView(
      this.state.snippetLanguage,
      request,
      version,
      harEntry
    );
    console.log("DevTools - getCodeView returned:", codeView);
    if (codeView) {
      this.setState((prevState) => ({ stack: [...prevState.stack, codeView] }));
    }
  }

  addListener() {
    if (!chrome.devtools) {
      return;
    }
    chrome.devtools.network.onRequestFinished.addListener(async (harEntry) => {
      try {
        if (
          harEntry.request &&
          harEntry.request.url &&
          isAllowedDomain(harEntry.request.url, this.state.ultraXRayMode)
        ) {
          const request = harEntry.request;

          // Pass both the request and the harEntry (which has getContent method)
          request._harEntry = harEntry;

          try {
            this.showRequest(request, harEntry);
          } catch (error) {
            console.log(error);
          }
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  async showRequest(request, harEntry = null) {
    console.log("DevTools - showRequest called with:", request, harEntry);
    if (request.url.includes("/$batch")) {
      console.log("Processing batch request - keeping as single unit");
      // For batch requests, treat them as a single unit to preserve request/response matching
      await this.addRequestToStack(request, "", harEntry);
    } else {
      await this.addRequestToStack(request, "", harEntry);
    }
  }

  // --- Filter helpers ---

  static extractMethod(displayRequestUrl) {
    if (!displayRequestUrl) return "";
    return displayRequestUrl.split(" ")[0].toUpperCase();
  }

  static isGuidSegment(segment) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
  }

  static buildResourceLabel(pathParts, startIndex) {
    if (startIndex >= pathParts.length) return "";
    const root = pathParts[startIndex].toLowerCase();
    // Walk remaining segments to find a non-GUID leaf
    for (let i = startIndex + 1; i < pathParts.length; i++) {
      if (!DevTools.isGuidSegment(pathParts[i])) {
        return `${root}-${pathParts[i].toLowerCase()}`;
      }
    }
    return root;
  }

  static extractResource(displayRequestUrl) {
    if (!displayRequestUrl) return "";
    const parts = displayRequestUrl.split(" ");
    const url = parts.length > 1 ? parts[1] : parts[0];
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      const start = pathParts.length > 0 && /^(v1\.0|beta)$/i.test(pathParts[0]) ? 1 : 0;
      return DevTools.buildResourceLabel(pathParts, start);
    } catch {
      const cleanUrl = url.split("?")[0];
      const pathParts = cleanUrl.replace(/^\/*/, "").split("/").filter(Boolean);
      const start = pathParts.length > 0 && /^(v1\.0|beta)$/i.test(pathParts[0]) ? 1 : 0;
      return DevTools.buildResourceLabel(pathParts, start);
    }
  }

  static extractResourceFromPath(urlPath) {
    if (!urlPath) return "";
    const cleanPath = urlPath.split("?")[0];
    const pathParts = cleanPath.replace(/^\/*/, "").split("/").filter(Boolean);
    const start = pathParts.length > 0 && /^(v1\.0|beta)$/i.test(pathParts[0]) ? 1 : 0;
    return DevTools.buildResourceLabel(pathParts, start);
  }

  static extractDomain(displayRequestUrl) {
    if (!displayRequestUrl) return "";
    const parts = displayRequestUrl.split(" ");
    const url = parts.length > 1 ? parts[1] : parts[0];
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }

  static isBatchItem(item) {
    return item.batchCodeSnippets && item.batchCodeSnippets.length > 0;
  }

  static getBatchResources(item) {
    if (!DevTools.isBatchItem(item)) return [];
    return item.batchCodeSnippets.map((s) => DevTools.extractResourceFromPath(s.url)).filter(Boolean);
  }

  static getBatchMethods(item) {
    if (!DevTools.isBatchItem(item)) return [];
    return item.batchCodeSnippets.map((s) => (s.method || "").toUpperCase()).filter(Boolean);
  }

  getFilteredStack() {
    const { stack, filterText, selectedMethods, selectedResources, selectedDomains } = this.state;
    const search = filterText.toLowerCase();
    return stack.filter((item) => {
      if (search && !item.displayRequestUrl.toLowerCase().includes(search)) {
        // Also search inside batch sub-request URLs
        if (!DevTools.isBatchItem(item) || !item.batchCodeSnippets.some((s) => s.url.toLowerCase().includes(search))) {
          return false;
        }
      }
      if (selectedMethods.size > 0) {
        if (DevTools.isBatchItem(item)) {
          if (!DevTools.getBatchMethods(item).some((m) => selectedMethods.has(m))) return false;
        } else {
          if (!selectedMethods.has(DevTools.extractMethod(item.displayRequestUrl))) return false;
        }
      }
      if (selectedResources.size > 0) {
        if (DevTools.isBatchItem(item)) {
          if (!DevTools.getBatchResources(item).some((r) => selectedResources.has(r))) return false;
        } else {
          if (!selectedResources.has(DevTools.extractResource(item.displayRequestUrl))) return false;
        }
      }
      if (selectedDomains.size > 0 && !selectedDomains.has(DevTools.extractDomain(item.displayRequestUrl))) return false;
      return true;
    });
  }

  getUniqueMethods() {
    const counts = {};
    this.state.stack.forEach((item) => {
      if (DevTools.isBatchItem(item)) {
        DevTools.getBatchMethods(item).forEach((m) => { counts[m] = (counts[m] || 0) + 1; });
      } else {
        const m = DevTools.extractMethod(item.displayRequestUrl);
        if (m) counts[m] = (counts[m] || 0) + 1;
      }
    });
    return counts;
  }

  getUniqueResources() {
    const counts = {};
    this.state.stack.forEach((item) => {
      if (DevTools.isBatchItem(item)) {
        DevTools.getBatchResources(item).forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
      } else {
        const r = DevTools.extractResource(item.displayRequestUrl);
        if (r) counts[r] = (counts[r] || 0) + 1;
      }
    });
    return counts;
  }

  getUniqueDomains() {
    const counts = {};
    this.state.stack.forEach((item) => {
      const d = DevTools.extractDomain(item.displayRequestUrl);
      if (d) counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }

  toggleSetItem(stateKey, value) {
    this.setState((prevState) => {
      const updated = new Set(prevState[stateKey]);
      if (updated.has(value)) {
        updated.delete(value);
      } else {
        updated.add(value);
      }
      return { [stateKey]: updated };
    });
  }

  getBatchFilter() {
    const { filterText, selectedMethods, selectedResources } = this.state;
    const hasFilter = filterText || selectedMethods.size > 0 || selectedResources.size > 0;
    if (!hasFilter) return null;
    const search = filterText.toLowerCase();
    return (method, url) => {
      if (search && !url.toLowerCase().includes(search)) return false;
      if (selectedMethods.size > 0 && !selectedMethods.has((method || "").toUpperCase())) return false;
      if (selectedResources.size > 0) {
        const resource = DevTools.extractResourceFromPath(url);
        if (!selectedResources.has(resource)) return false;
      }
      return true;
    };
  }

  onLanguageChange = (e, option) => {
    this.setState({ snippetLanguage: option.key });
    this.clearStack();
  };

  onUltraXRayToggle = (e, checked) => {
    this.setState({ ultraXRayMode: checked });
    // Save to localStorage
    localStorage.setItem('graphxray-ultraXRayMode', JSON.stringify(checked));
    this.clearStack(); // Clear the stack when toggling mode
  };
  render() {
    return (
      <div className="App" style={{ fontSize: FontSizes.size12 }}>
        <Layer>
          <div
            style={{
              boxShadow: theme.effects.elevation4,
            }}
          >
            <AppHeader hideSettings={true}></AppHeader>
            <DevToolsCommandBar
              clearStack={this.clearStack}
              saveScript={this.saveScript}
              copyScript={this.copyScript}
            ></DevToolsCommandBar>
          </div>
        </Layer>
        <header className="App-header">
          <div
            style={{
              boxShadow: theme.effects.elevation16,
              padding: "10px",
              marginTop: "80px",
              marginBottom: "15px",
            }}
          >
            <h2>Graph Call Stack Trace</h2>
            <p>
              Displays the Graph API calls that are being made by the current
              browser tab. Code conversions are only available for published Graph APIs.
              Turn on <strong>Ultra X-Ray</strong> mode to see all API calls (open a <a href="https://github.com/merill/graphxray/issues" target="_blank" rel="noreferrer">GitHub issue</a> if there are admin portals or blades that are not being captured).
            </p>
            <div style={{ 
              display: "flex", 
              alignItems: "flex-end", 
              gap: "20px",
              flexWrap: "wrap" 
            }}>
              <Dropdown
                placeholder="Select an option"
                label="Select language"
                options={options}
                styles={dropdownStyles}
                defaultSelectedKey={this.state.snippetLanguage}
                onChange={this.onLanguageChange}
              />
              
              <div style={{ 
                display: "flex", 
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px" // Align with dropdown bottom margin
              }}>
                <Toggle
                  label="Ultra X-Ray"
                  checked={this.state.ultraXRayMode}
                  onChange={this.onUltraXRayToggle}
                  onText="On"
                  offText="Off"
                  styles={{
                    root: { marginBottom: 0 },
                    label: { fontWeight: "600" }
                  }}
                />
                <TooltipHost
                  content="Enables ultra mode which allows you to see API calls that are not publicly documented by Microsoft. These are meant for educational purposes. These endpoints should not be used in custom scripts as they are not supported by Microsoft and are only meant for internal use."
                  styles={{
                    root: {
                      display: "inline-block"
                    }
                  }}
                >
                  <IconButton
                    iconProps={{ iconName: "Info" }}
                    title="Ultra X-Ray Information"
                    styles={{
                      root: {
                        minWidth: "24px",
                        width: "24px",
                        height: "24px",
                        color: "#666",
                        backgroundColor: "transparent",
                        border: "1px solid #ccc",
                        borderRadius: "50%"
                      },
                      rootHovered: {
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                        color: "#333"
                      }
                    }}
                  />
                </TooltipHost>
              </div>
            </div>
          </div>
          {this.state.stack && this.state.stack.length > 0 && (() => {
            const methodCounts = this.getUniqueMethods();
            const resourceCounts = this.getUniqueResources();
            const domainCounts = this.getUniqueDomains();
            const filteredStack = this.getFilteredStack();
            const showDomainFilter = this.state.ultraXRayMode && Object.keys(domainCounts).length > 1;
            const countRequests = (items) => items.reduce((n, item) =>
              n + (DevTools.isBatchItem(item) ? item.batchCodeSnippets.length : 1), 0);
            const totalCount = countRequests(this.state.stack);
            const filteredCount = countRequests(filteredStack);
            return (
            <div
              style={{
                boxShadow: theme.effects.elevation16,
                padding: "10px",
                marginBottom: "15px",
              }}
            >
              {/* Filter bar */}
              <div className="gxr-filter-bar">
                <div className="gxr-filter-header">
                  <button
                    className="gxr-filter-toggle"
                    onClick={() => this.setState((prev) => ({ filtersExpanded: !prev.filtersExpanded }))}
                    title={this.state.filtersExpanded ? "Collapse filters" : "Expand filters"}
                  >
                    <span className={`gxr-filter-chevron ${this.state.filtersExpanded ? "gxr-filter-chevron-open" : ""}`}>&#9656;</span>
                    Filters
                  </button>
                  <span className="gxr-filter-count">
                    {filteredCount === totalCount
                      ? `${totalCount} requests`
                      : `${filteredCount} of ${totalCount} requests`}
                  </span>
                  {(this.state.filterText || this.state.selectedMethods.size > 0 || this.state.selectedResources.size > 0 || this.state.selectedDomains.size > 0) && (
                    <button
                      className="gxr-pill gxr-pill-clear"
                      onClick={() => this.setState({ filterText: "", selectedMethods: new Set(), selectedResources: new Set(), selectedDomains: new Set() })}
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                {this.state.filtersExpanded && (
                  <div className="gxr-filter-body">
                    <SearchBox
                      placeholder="Filter by URL..."
                      value={this.state.filterText}
                      onChange={(_, val) => this.setState({ filterText: val || "" })}
                      onClear={() => this.setState({ filterText: "" })}
                      styles={{ root: { maxWidth: 300, minWidth: 180 } }}
                    />

                    {Object.keys(methodCounts).length > 0 && (
                      <div className="gxr-pill-group">
                        <span className="gxr-pill-label">Method</span>
                        {Object.entries(methodCounts).sort((a, b) => a[0].localeCompare(b[0])).map(([method, count]) => (
                          <button
                            key={method}
                            className={`gxr-pill gxr-pill-method ${this.state.selectedMethods.has(method) ? "gxr-pill-active" : ""}`}
                            onClick={() => this.toggleSetItem("selectedMethods", method)}
                          >
                            {method} <span className="gxr-pill-count">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {Object.keys(resourceCounts).length > 0 && (
                      <div className="gxr-pill-group">
                        <span className="gxr-pill-label">Resource</span>
                        {Object.entries(resourceCounts).sort((a, b) => b[1] - a[1]).map(([resource, count]) => (
                          <button
                            key={resource}
                            className={`gxr-pill gxr-pill-resource ${this.state.selectedResources.has(resource) ? "gxr-pill-active" : ""}`}
                            onClick={() => this.toggleSetItem("selectedResources", resource)}
                          >
                            {resource} <span className="gxr-pill-count">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {showDomainFilter && (
                      <div className="gxr-pill-group">
                        <span className="gxr-pill-label">Domain</span>
                        {Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).map(([domain, count]) => (
                          <button
                            key={domain}
                            className={`gxr-pill gxr-pill-domain ${this.state.selectedDomains.has(domain) ? "gxr-pill-active" : ""}`}
                            onClick={() => this.toggleSetItem("selectedDomains", domain)}
                          >
                            {domain} <span className="gxr-pill-count">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {filteredStack.map((request, index) => (
                <div
                  key={index}
                  style={{
                    boxShadow: theme.effects.elevation16,
                    padding: "10px",
                    marginBottom: "15px",
                    borderRadius: "8px",
                  }}
                >
                  <CodeView
                    request={request}
                    lightUrl={true}
                    snippetLanguage={this.state.snippetLanguage}
                    batchFilter={this.getBatchFilter()}
                  ></CodeView>
                </div>
              ))}
            </div>
            );
          })()}
        </header>
      </div>
    );
  }
}

export default DevTools;
