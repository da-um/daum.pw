import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { boot } from './boot/plugin';

// Where the built files are served from: scripts/deploy.mjs points it at lu1.
// Unset, they sit next to the page.
const assetBase = process.env.DAUM_ASSET_BASE;

export default defineConfig({
  plugins: [react(), boot(assetBase ?? '/')],
  // Not dist/: the homepage is served by daum.pw, and Caddy reads dist/ from this
  // directory directly, so only the deploy script writes there (2026-10-27 域名对调后更新).
  build: { outDir: '.out' },
  experimental: {
    // Fonts and pictures relative to the script or style that asks for them, so the copy
    // on lu1 and the one here (boot.js falls back to it) each load from their own place.
    renderBuiltUrl: (_, { hostType }) => (hostType === 'html' ? undefined : { relative: true }),
  },
});
