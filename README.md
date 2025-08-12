# Amazon Synchrony YNAB Bookmarklet

A bookmarklet that syncs transactions from your Amazon Synchrony Store Card activity page to YNAB (You Need A Budget).

## Features

- **Transaction Matching**: Automatically matches card transactions with existing YNAB transactions
- **Memo Updates**: Updates YNAB transaction memos with detailed descriptions from the card activity
- **New Transaction Creation**: Creates missing transactions in YNAB
- **Flexible Date Matching**: Optional �1 day tolerance for matching transactions
- **Interactive Review**: Preview all changes before applying them
- **Selective Updates**: Choose which transactions to update or create
- **Auto-updating**: Always uses the latest released version

## Quick Start

### Option 1: Use Latest Release (Recommended)

Create a bookmark in your browser with this code:

```javascript
javascript:!function(){const e=document.createElement("div");e.style.cssText="\n    position: fixed;\n    top: 20px;\n    right: 20px;\n    padding: 10px 20px;\n    background: #007bff;\n    color: white;\n    border-radius: 4px;\n    font-family: Arial, sans-serif;\n    z-index: 10000;\n    box-shadow: 0 2px 4px rgba(0,0,0,0.2);\n  ",e.textContent="Loading YNAB Sync Bookmarklet...",document.body.appendChild(e),fetch("https://api.github.com/repos/radusuciu/amazon-synchrony-ynab-bookmarklet/releases/latest").then(e=>e.json()).then(o=>{const n=o.assets.find(e=>"bookmarklet.min.js"===e.name);if(!n)throw new Error("Bookmarklet file not found in latest release");const t=document.createElement("script");t.src=n.browser_download_url,t.onload=()=>{document.body.removeChild(e),document.head.removeChild(t)},t.onerror=()=>{document.body.removeChild(e),document.head.removeChild(t),alert("Failed to load bookmarklet script")},document.head.appendChild(t)}).catch(o=>{document.body.contains(e)&&document.body.removeChild(e),alert(`Failed to load YNAB bookmarklet: ${o.message}\n\nMake sure you're on the Amazon Synchrony activity page.`),console.error("Bookmarklet loading error:",o)})}();
```

This bookmarklet automatically fetches and runs the latest version from GitHub releases.

### Option 2: Build from Source

#### Prerequisites

- Node.js and npm installed
- YNAB account with API access
- Amazon Synchrony Store Card account

#### Installation

1. Clone the repository:
```bash
git clone https://github.com/radusuciu/amazon-synchrony-ynab-bookmarklet.git
cd amazon-synchrony-ynab-bookmarklet
```

2. Install dependencies:
```bash
npm install
```

3. Build the bookmarklet:
```bash
npm run build
```

The minified bookmarklet will be created at `dist/bookmarklet.min.js`

### Configuration

On first run, the bookmarklet will prompt you to enter:

- **YNAB API Token**: Get this from [YNAB Developer Settings](https://app.ynab.com/settings/developer)
- **Budget ID**: The YNAB budget to sync with
- **Account ID**: The specific account ID for your Amazon Store Card in YNAB

These settings are stored securely in your browser's localStorage.

## Usage

1. Navigate to your Amazon Synchrony Store Card activity page
2. Click the bookmarklet in your bookmarks bar
3. On first run, enter your YNAB credentials when prompted
4. Review the proposed changes
5. Click "Confirm" to sync transactions

### What Happens Next

1. **First Run**: Enter your YNAB API credentials when prompted
2. **Transaction Analysis**: The bookmarklet analyzes transactions from both sources
3. **Review Dialog**: A dialog shows:
   - Transactions to update (with memo changes)
   - New transactions to create (missing from YNAB)
   - Unmatched YNAB transactions (informational)
4. **Date Tolerance**: Toggle �1 day matching and re-run if needed
5. **Select & Confirm**: Choose which changes to apply and click Confirm

## Transaction Matching Logic

- **Exact Match**: Same amount and date
- **Fuzzy Match**: Same amount within �1 day (when enabled)
- **Payments**: Automatically skipped (not synced to YNAB)
- **Status Mapping**: "Posted" � cleared, others � uncleared

## Development

### Creating a New Release

This project uses semantic versioning. To create a new release:

```bash
# For a patch release (bug fixes): 0.1.0 -> 0.1.1
npm version patch

# For a minor release (new features): 0.1.0 -> 0.2.0
npm version minor

# For a major release (breaking changes): 0.1.0 -> 1.0.0
npm version major

# Push the commit and tag to GitHub
git push && git push --tags
```

The GitHub Actions workflow will automatically:
1. Build the bookmarklet
2. Create a GitHub release
3. Upload the minified JavaScript file

Users with the bookmarklet will automatically get the latest version on next use.

### Build Commands

```bash
npm run build       # Build minified bookmarklet
npm run build:tsc   # TypeScript compilation only
```

### Technologies Used

- TypeScript
- Vite (build tool)
- Terser (minification)
- YNAB API v1

## Security Notes

- API credentials are stored locally in your browser
- No data is sent to external servers (except YNAB API)
- All processing happens in your browser
- Credentials are never exposed in the source code

## Troubleshooting

### Common Issues

1. **No transactions found**: Make sure you're on the activity page of your Amazon Store Card
2. **API errors**: Verify your YNAB API token is valid and has appropriate permissions
3. **Missing transactions**: Check the date range - the bookmarklet only looks at transactions visible on the page
4. **Duplicate transactions**: The bookmarklet checks for existing transactions to avoid duplicates

### Clearing Settings

To reset your stored credentials, run this in the browser console:
```javascript
localStorage.removeItem('ynab_bookmarklet_settings');
```

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Disclaimer

This tool is not affiliated with YNAB or Amazon/Synchrony. Use at your own risk. Always review changes before confirming them.