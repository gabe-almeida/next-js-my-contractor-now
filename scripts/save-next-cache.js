/**
 * Save Next.js build cache into node_modules/.cache for Render persistence
 *
 * WHY: Render auto-caches node_modules between deploys.
 *      By saving .next/cache inside node_modules/.cache, the webpack/compilation
 *      cache survives across deploys → incremental builds for small changes.
 *
 * WHEN: Runs after `next build` completes successfully.
 *
 * HOW: Copies .next/cache → node_modules/.cache/next-build
 */
const fs = require('fs');
const path = require('path');

const CACHE_SOURCE = path.join(__dirname, '..', '.next', 'cache');
const CACHE_DEST = path.join(__dirname, '..', 'node_modules', '.cache', 'next-build');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(CACHE_SOURCE)) {
  // Clear old cache first to avoid stale files growing indefinitely
  if (fs.existsSync(CACHE_DEST)) {
    fs.rmSync(CACHE_DEST, { recursive: true, force: true });
  }
  console.log('[build-cache] Saving .next/cache for next deploy...');
  copyRecursive(CACHE_SOURCE, CACHE_DEST);
  console.log('[build-cache] Cache saved to node_modules/.cache/next-build');
} else {
  console.log('[build-cache] No .next/cache to save.');
}
