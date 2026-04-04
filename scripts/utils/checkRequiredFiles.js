'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('react-dev-utils/chalk');

function checkRequiredFiles(files) {
  let currentFilePath;
  try {
    files.forEach(filePath => {
      currentFilePath = filePath;
      // Use fs.constants.F_OK to avoid Node deprecation warnings for fs.F_OK.
      fs.accessSync(filePath, fs.constants.F_OK);
    });
    return true;
  } catch (err) {
    const dirName = path.dirname(currentFilePath);
    const fileName = path.basename(currentFilePath);
    console.log(chalk.red('Could not find a required file.'));
    console.log(chalk.red('  Name: ') + chalk.cyan(fileName));
    console.log(chalk.red('  Searched in: ') + chalk.cyan(dirName));
    return false;
  }
}

module.exports = checkRequiredFiles;