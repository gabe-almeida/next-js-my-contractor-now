/**
 * Restore Next.js build cache from node_modules/.cache
 *
 * WHY: Render caches node_modules between builds but NOT .next/cache.
 *      Without this, every deploy is a full rebuild (~3-5min).
 *      With cache restored, incremental builds take ~30-60s for small changes.
 *
 * WHEN: Runs before `next build` in the build script.
 *
 * HOW: Copies cached webpack/Next.js compilation data from
 *      node_modules/.cache/next-build → .next/cache
 */
const fs = require('fs');
const path = require('path');

const CACHE_SOURCE = path.join(__dirname, '..', 'node_modules', '.cache', 'next-build');
const CACHE_DEST = path.join(__dirname, '..', '.next', 'cache');

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
  console.log('[build-cache] Restoring .next/cache from previous build...');
  copyRecursive(CACHE_SOURCE, CACHE_DEST);
  console.log('[build-cache] Cache restored.');
} else {
  console.log('[build-cache] No previous cache found, full build will run.');
}
