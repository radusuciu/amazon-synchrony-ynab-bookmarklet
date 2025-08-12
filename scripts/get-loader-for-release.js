#!/usr/bin/env node

const { updateLoader } = require("./update-loader");

// Generate the minified loader and output it for GitHub Actions
// Use silent mode to suppress console output
updateLoader({ silent: true })
  .then((bookmarkletCode) => {
    // Output just the code for GitHub Actions to use
    process.stdout.write(bookmarkletCode);
  })
  .catch((err) => {
    // Write errors to stderr so they don't contaminate the output
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
