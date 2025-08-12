// Bookmarklet Loader - Uses script tag injection to bypass CORS
// This fetches and executes the latest release from GitHub
(function () {
  const REPO_OWNER = "radusuciu";
  const REPO_NAME = "amazon-synchrony-ynab-bookmarklet";

  // Show loading indicator
  const loadingDiv = document.createElement("div");
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
  loadingDiv.textContent = "Loading YNAB Sync Bookmarklet...";
  document.body.appendChild(loadingDiv);

  // First, fetch the latest release info from GitHub API
  fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
  )
    .then((response) => response.json())
    .then((data) => {
      // Find the bookmarklet.min.js asset
      const asset = data.assets.find((a) => a.name === "bookmarklet.min.js");
      if (!asset) {
        throw new Error("Bookmarklet file not found in latest release");
      }

      // Create script element with the download URL
      const script = document.createElement("script");
      script.src = asset.browser_download_url;

      script.onload = () => {
        // Remove loading indicator and script tag
        document.body.removeChild(loadingDiv);
        document.head.removeChild(script);
      };

      script.onerror = () => {
        document.body.removeChild(loadingDiv);
        document.head.removeChild(script);
        alert("Failed to load bookmarklet script");
      };

      // Append script to head to execute it
      document.head.appendChild(script);
    })
    .catch((error) => {
      // Remove loading indicator
      if (document.body.contains(loadingDiv)) {
        document.body.removeChild(loadingDiv);
      }

      // Show error
      alert(
        `Failed to load YNAB bookmarklet: ${error.message}\n\nMake sure you're on the Amazon Synchrony activity page.`
      );
      console.error("Bookmarklet loading error:", error);
    });
})();
