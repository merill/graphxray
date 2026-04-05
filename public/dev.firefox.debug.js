// Firefox-compatible devtools panel creation with debugging
(function() {
  console.log("Graph X-Ray: dev.firefox.debug.js loaded");
  
  const api = typeof browser !== 'undefined' ? browser : chrome;
  console.log("Graph X-Ray: Using API:", typeof browser !== 'undefined' ? 'browser' : 'chrome');
  
  if (!api.devtools) {
    console.error("Graph X-Ray: devtools API not available!");
    return;
  }
  
  if (!api.devtools.panels) {
    console.error("Graph X-Ray: devtools.panels API not available!");
    return;
  }
  
  console.log("Graph X-Ray: Creating panel...");
  
  api.devtools.panels.create(
    "Graph X-Ray",
    "", // Firefox requires empty string instead of null for icon
    "devtools.html", // Firefox prefers relative path without leading slash
    function (panel) {
      if (api.runtime.lastError) {
        console.error("Graph X-Ray: Error creating panel:", api.runtime.lastError);
      } else {
        console.log("Graph X-Ray: Panel created successfully!", panel);
      }
    }
  );
})();