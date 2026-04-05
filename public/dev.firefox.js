// Firefox-compatible devtools panel creation
(function() {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  
  api.devtools.panels.create(
    "Graph X-Ray",
    "", // Firefox requires empty string instead of null for icon
    "devtools.html", // Firefox prefers relative path without leading slash
    function (panel) {
      console.log("Graph X-Ray panel created: ", panel);
    }
  );
})();