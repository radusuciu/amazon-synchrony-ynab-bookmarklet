#!/usr/bin/env node

const { updateLoader } = require('./update-loader');

// Generate the minified loader and output it for GitHub Actions
updateLoader()
  .then(bookmarkletCode => {
    // Output just the code for GitHub Actions to use
    process.stdout.write(bookmarkletCode);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });