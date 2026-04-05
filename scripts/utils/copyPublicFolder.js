'use strict';

const path = require('path');
const fs = require('fs-extra');
const paths = require('../../config/paths');

function copyPublicFolder(buildFolder) {
  fs.copySync(paths.appPublic, buildFolder, {
    dereference: true,
    // Exclude Firefox-only assets from the default build output.
    filter: file => {
      if (file === paths.appPopupHtml || file === paths.appOptionsHtml) {
        return false;
      }

      const fileName = path.basename(file);
      if (!fileName) {
        return true;
      }

      return !fileName.includes('.firefox.');
    },
  });
}

module.exports = copyPublicFolder;
