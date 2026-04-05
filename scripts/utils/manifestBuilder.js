'use strict';

const fs = require('fs-extra');

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function createFirefoxManifest({
  chromiumManifestPath,
  firefoxManifestTemplatePath,
  outputManifestPath,
}) {
  const chromiumManifest = fs.readJsonSync(chromiumManifestPath);
  const firefoxTemplate = fs.readJsonSync(firefoxManifestTemplatePath);

  const action = chromiumManifest.action || {};

  const firefoxManifest = {
    ...firefoxTemplate,
    // Keep shared extension identity fields in one place (public/manifest.json).
    version: chromiumManifest.version,
    name: chromiumManifest.name,
    short_name: chromiumManifest.short_name,
    description: chromiumManifest.description,
    icons: chromiumManifest.icons,
    content_scripts: chromiumManifest.content_scripts,
    devtools_page: chromiumManifest.devtools_page,
    browser_action: {
      ...(firefoxTemplate.browser_action || {}),
      default_title: action.default_title,
      default_popup: action.default_popup,
    },
  };

  const firefoxTemplatePermissions = Array.isArray(firefoxTemplate.permissions)
    ? firefoxTemplate.permissions
    : [];
  const chromiumPermissions = Array.isArray(chromiumManifest.permissions)
    ? chromiumManifest.permissions
    : [];
  const chromiumHostPermissions = Array.isArray(chromiumManifest.host_permissions)
    ? chromiumManifest.host_permissions
    : [];

  // Firefox MV2 stores host origins in permissions, so merge them from Chromium host_permissions.
  firefoxManifest.permissions = unique([
    ...firefoxTemplatePermissions,
    ...chromiumPermissions,
    ...chromiumHostPermissions,
  ]);

  fs.writeJsonSync(outputManifestPath, firefoxManifest, { spaces: 2 });
  return firefoxManifest;
}

module.exports = {
  createFirefoxManifest,
};