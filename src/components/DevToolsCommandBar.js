import * as React from "react";
import { CommandBar } from "@fluentui/react/lib/CommandBar";
import { DownloadIcon, DeleteIcon } from "./Icons";

class DevToolsCommandBar extends React.Component {
  render() {
    const _items = [
      {
        key: "download",
        text: "Save script",
        onClick: this.props.saveScript,
        onRenderIcon: () => <DownloadIcon />,
      },
      {
        key: "clear",
        text: "Clear session",
        onClick: this.props.clearStack,
        onRenderIcon: () => <DeleteIcon />,
      },
    ];

    return (
      <div>
        <CommandBar items={_items} ariaLabel="Save script and clear items" />
      </div>
    );
  }
}

export default DevToolsCommandBar;
