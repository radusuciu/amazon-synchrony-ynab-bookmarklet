// Bookmarklet Loader - This fetches and executes the latest release from GitHub
// To use: Create a bookmark with this code (minified version below)
(function() {
  const REPO = 'radusuciu/amazon-synchrony-ynab-bookmarklet';
  const RELEASE_URL = `https://github.com/${REPO}/releases/latest/download/bookmarklet.min.js`;
  
  // Show loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;
  loadingDiv.textContent = 'Loading YNAB Sync Bookmarklet...';
  document.body.appendChild(loadingDiv);
  
  // Fetch and execute the latest bookmarklet
  fetch(RELEASE_URL)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    })
    .then(script => {
      // Remove loading indicator
      document.body.removeChild(loadingDiv);
      
      // Execute the bookmarklet
      eval(script);
    })
    .catch(error => {
      // Remove loading indicator
      if (document.body.contains(loadingDiv)) {
        document.body.removeChild(loadingDiv);
      }
      
      // Show error
      alert(`Failed to load YNAB bookmarklet: ${error.message}\n\nMake sure you're on the Amazon Synchrony activity page.`);
      console.error('Bookmarklet loading error:', error);
    });
})();

// Minified version for bookmark (copy this):
// javascript:(function(){const e="radusuciu/amazon-synchrony-ynab-bookmarklet",t=`https://github.com/${e}/releases/latest/download/bookmarklet.min.js`,o=document.createElement("div");o.style.cssText="position:fixed;top:20px;right:20px;padding:10px 20px;background:#007bff;color:white;border-radius:4px;font-family:Arial,sans-serif;z-index:10000;box-shadow:0 2px 4px rgba(0,0,0,0.2)",o.textContent="Loading YNAB Sync Bookmarklet...",document.body.appendChild(o),fetch(t).then(e=>{if(!e.ok)throw new Error(`HTTP ${e.status}: ${e.statusText}`);return e.text()}).then(e=>{document.body.removeChild(o),eval(e)}).catch(e=>{document.body.contains(o)&&document.body.removeChild(o),alert(`Failed to load YNAB bookmarklet: ${e.message}\n\nMake sure you're on the Amazon Synchrony activity page.`),console.error("Bookmarklet loading error:",e)})})();