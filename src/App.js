import "./App.css";
import React from "react";
import { PrimaryButton, getTheme } from "@fluentui/react";
import { FontSizes } from "@fluentui/theme";
import { AppHeader } from "./components/AppHeader";
import {
  saveObjectInLocalStorage,
  getIsActive,
  getCurrentMetrics,
  getStack,
} from "./common/storage.js";
import { openOptionsPage } from "./components/CommandMenu.js";
import { runtime } from "./common/browserApi.js";

const theme = getTheme();

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      message: "",
      isActive: false,
      stack: [],
      doc: "",
      recentCode: "",
      recentGraphUri: "",
    };
  }

  componentDidMount() {
    // Add listener when component mounts
    this.timerID = setInterval(() => this.getMetrics(), 500);
    // Add listener when component mounts
    this.addListener();
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  getMetrics = async () => {
    let currentMetrics = await getCurrentMetrics();
    let { urls, tabName } = currentMetrics;
    let isActive = await getIsActive();
    let stack = await getStack();

    //Get the most recent PowerShell command
    let recentGraphUri = "";
    let recentCode = "";
    if (urls.length > 0) {
      for (let i = 0; i < urls.length; i++) {
        recentCode = urls[0].ps;
        if (recentCode !== "") {
          recentGraphUri = urls[i].url;
          break;
        }
      }
    }

    this.setState({
      message: {
        urls,
        tabName,
      },
      stack: stack,
      isActive: isActive,
      recentCode: recentCode,
      recentGraphUri: recentGraphUri,
    });
  };

  addListener() {
    if (!window.chrome.webview) {
      return;
    }
    window.chrome.webview.addEventListener("message", (event) => {
      console.log("Got message from host!");
      console.log(event.data);
    });
  }

  toggleStart = async () => {
    this.setState({ isActive: !this.state.isActive });

    if (this.state.isActive) {
      try {
        const response = await runtime.sendMessage({ method: "start" });
        console.log(response.farewell);
      } catch (error) {
        console.error("Error sending start message:", error);
      }

      saveObjectInLocalStorage({
        isActive: this.state.isActive,
        contextSwitches: 0,
      });
    } else {
      try {
        await runtime.sendMessage({ method: "stop" });
      } catch (error) {
        console.error("Error sending stop message:", error);
      }
      saveObjectInLocalStorage({
        isActive: this.state.isActive,
      });
    }
  };

  render() {
    return (
      <div className="App" style={{ fontSize: FontSizes.size12 }}>
        <AppHeader></AppHeader>
        <div className="App-body">
          <div
            style={{
              boxShadow: theme.effects.elevation16,
              padding: "10px",
              marginBottom: "15px",
            }}
          >
            <h2>Graph call history</h2>
            <p>
              To view Graph calls in real-time open Developer Tools and switch
              to the Graph X-Ray panel.
            </p>
            <PrimaryButton
              onClick={openOptionsPage}
              iconProps={{ iconName: "OpenInNewTab" }}
            >
              Show me how
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }
}

export default App;