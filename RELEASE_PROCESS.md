# Release Process

This document describes the automated release process for the Amazon Synchrony YNAB Bookmarklet.

## Overview

The project now uses an automated system to:
1. Build and minify the main bookmarklet (`bookmarklet.ts`)
2. Build and minify the loader bookmarklet (`bookmarklet-loader.js`)
3. Automatically update README with the latest loader code
4. Create GitHub releases with the correct loader code

## Key Files

- `src/bookmarklet.ts` - Main bookmarklet source code
- `src/bookmarklet-loader.js` - Loader that fetches the latest release (source of truth)
- `scripts/update-loader.js` - Minifies the loader and optionally updates README
- `scripts/get-loader-for-release.js` - Used by GitHub Actions to get loader code

## Commands

### Build Commands

```bash
# Build main bookmarklet only
npm run build

# Build loader bookmarklet only
npm run build:loader

# Build both bookmarklets
npm run build:all

# Update README with latest minified loader
npm run update-readme
```

### Release Commands

```bash
# Create a patch release (0.1.0 -> 0.1.1)
npm version patch

# Create a minor release (0.1.0 -> 0.2.0)
npm version minor

# Create a major release (0.1.0 -> 1.0.0)
npm version major

# Push to GitHub (triggers automated release)
git push && git push --tags
```

## Automated Release Process

When you run `npm version [patch|minor|major]`:

1. **Pre-version hook** (`preversion` script) automatically:
   - Builds both bookmarklets
   - Updates README with the latest minified loader code
   - These changes are included in the version commit

2. **Version bump** happens (package.json and package-lock.json updated)

3. **Git tag** is created (e.g., `v0.1.3`)

4. When you **push the tag** to GitHub, GitHub Actions:
   - Builds both bookmarklets
   - Gets the minified loader code
   - Creates a GitHub release with:
     - The minified bookmarklet files as assets
     - Installation instructions with the correct loader code
     - Auto-generated release notes

## Making Changes to the Loader

If you need to update the loader logic:

1. Edit `src/bookmarklet-loader.js`
2. Run `npm run update-readme` to update the README immediately
3. The next release will automatically include the updated loader

## Build Outputs

After building, you'll find:
- `dist/bookmarklet.min.js` - The main bookmarklet
- `dist/bookmarklet-loader.min.js` - The minified loader (includes `javascript:` prefix)

## Notes

- The loader in `src/bookmarklet-loader.js` is the single source of truth
- README is automatically updated during the release process
- GitHub release notes always use the latest loader code
- Both minified files are attached to GitHub releases for transparency