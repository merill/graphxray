// Use a higher-resolution source icon so the DevTools tab icon stays crisp when scaled.
chrome.devtools.panels.create("Graph X-Ray", "img/icon-48.png", "/devtools.html", function (panel) {
    console.log("Graph X-Ray: ", panel);
  }
);