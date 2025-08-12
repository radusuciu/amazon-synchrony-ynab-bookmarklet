#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

async function updateLoader() {
  // Read the loader source
  const loaderPath = path.join(__dirname, '..', 'src', 'bookmarklet-loader.js');
  let loaderContent = fs.readFileSync(loaderPath, 'utf8');
  
  // Extract just the IIFE part (not the comments at the end)
  const iifePart = loaderContent.match(/\(function\(\)\s*{[\s\S]*?}\)\(\);/);
  if (!iifePart) {
    throw new Error('Could not find IIFE in bookmarklet-loader.js');
  }
  
  // Minify the loader
  const minified = await minify(iifePart[0], {
    compress: {
      drop_console: false,
      drop_debugger: true,
    },
    format: {
      comments: false,
    },
    mangle: true,
  });
  
  if (minified.error) {
    throw minified.error;
  }
  
  // Wrap in javascript: protocol
  const bookmarkletCode = `javascript:${minified.code}`;
  
  // Save minified loader to dist
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }
  fs.writeFileSync(path.join(distPath, 'bookmarklet-loader.min.js'), bookmarkletCode);
  
  // Update README if --update-readme flag is passed
  if (process.argv.includes('--update-readme')) {
    const readmePath = path.join(__dirname, '..', 'README.md');
    let readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    // Find and replace the bookmarklet code in README
    // Look for the javascript code block after "Create a bookmark in your browser with this code:"
    const pattern = /```javascript\njavascript:.*?\n```/s;
    const replacement = `\`\`\`javascript\n${bookmarkletCode}\n\`\`\``;
    
    if (pattern.test(readmeContent)) {
      readmeContent = readmeContent.replace(pattern, replacement);
      fs.writeFileSync(readmePath, readmeContent);
      console.log('✅ README.md updated with new bookmarklet loader');
    } else {
      console.warn('⚠️  Could not find bookmarklet code block in README.md');
    }
  }
  
  console.log('✅ Bookmarklet loader minified and saved to dist/bookmarklet-loader.min.js');
  return bookmarkletCode;
}

// Run if called directly
if (require.main === module) {
  updateLoader().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { updateLoader };