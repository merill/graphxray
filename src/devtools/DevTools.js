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
import DevToolsCommandBar from "../components/DevToolsCommandBar";
import { Layer } from "@fluentui/react/lib/Layer";

const theme = getTheme();

const dropdownStyles = {
  dropdown: { width: 300 },
};

const options = [
  { key: "powershell", text: "PowerShell", fileExt: "ps1" },
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
    if (this.state.snippetLanguage === "powershell") {
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
          {this.state.stack && this.state.stack.length > 0 && (
            <div
              style={{
                boxShadow: theme.effects.elevation16,
                padding: "10px",
                marginBottom: "15px",
              }}
            >
              {this.state.stack.map((request, index) => (
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
                  ></CodeView>
                </div>
              ))}
            </div>
          )}
        </header>
      </div>
    );
  }
}

export default DevTools;
