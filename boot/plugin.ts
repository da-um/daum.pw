import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { BRAND_BOUNDS, BRAND_PATHS } from '../src/data/brand-glyph';
import { FOV, MARK_FIT, MARK_H, MARK_INTRO, MARK_LAYERS, MARK_REST, MARK_SINK, MARK_STEP, MARK_W } from '../src/lib/mark';
import { FACE, shade, type RGB } from '../src/lib/palette';

// The loading screen, written into index.html so it shows before any script
// arrives: the opening wordmark as an SVG stack, the same picture the scene
// draws (scene/Wordmark.tsx), whose layers fly together as the page loads.
//
// In a build, the page's own script and style tags come out of the HTML and a
// list of what to load, with sizes, goes in: boot.js loads it all itself, so
// it can count the bytes, then starts the app from the cache.

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const color = (c: RGB) => `rgb(${c.map((v) => +(v * 255).toFixed(2)).join(' ')})`;

function wordmark() {
  const { x, y, w, h } = BRAND_BOUNDS;
  // Deepest first, so the face is drawn last, on top. boot.js places them.
  const layers = Array.from({ length: MARK_LAYERS }, (_, n) => MARK_LAYERS - 1 - n).map((i) => {
    const fill = i === 0 ? 'url(#boot-face)' : color(shade((i - 1) / (MARK_LAYERS - 2)));
    return `<use href="#boot-mark" data-i="${i}" fill="${fill}" opacity="0"/>`;
  });
  return [
    `<svg viewBox="${x} 0 ${w} ${h}" aria-hidden="true">`,
    `<defs><linearGradient id="boot-face" gradientUnits="userSpaceOnUse" x1="${x}" y1="0" x2="${x + w}" y2="0">`,
    `<stop offset="0" stop-color="${color(FACE[0])}"/><stop offset="1" stop-color="${color(FACE[1])}"/></linearGradient>`,
    `<g id="boot-mark" transform="translate(0 ${y + h}) scale(1 -1)">${BRAND_PATHS.map((d) => `<path d="${d}"/>`).join('')}</g></defs>`,
    ...layers,
    '</svg>',
  ].join('');
}

/** What boot.js needs to place the layers as the scene would. */
function mark() {
  const { x, w, h } = BRAND_BOUNDS;
  return JSON.stringify({
    // World units to the SVG's font units, and the SVG's center (the scene's origin).
    unit: w / MARK_W,
    center: [x + w / 2, h / 2],
    w: MARK_W,
    h: MARK_H,
    fit: MARK_FIT,
    fov: FOV,
    layers: MARK_LAYERS,
    step: MARK_STEP,
    sink: MARK_SINK,
    rest: MARK_REST,
    intro: MARK_INTRO,
  });
}

/** The wordmark's width on screen in the opening, as CSS: what world.ts frames with the camera. */
function width() {
  const byHeight = (MARK_FIT.height * MARK_W) / MARK_H;
  const fit = (share: number) => `min(${share * 100}vw, ${+(byHeight * 100).toFixed(2)}vh)`;
  return { wide: fit(MARK_FIT.wide), tall: fit(MARK_FIT.tall), wideD: fit(MARK_FIT.wide).replace('vh', 'dvh'), tallD: fit(MARK_FIT.tall).replace('vh', 'dvh') };
}

/** `base`: where the built files are served from, '/' or a full URL ending in '/'. */
export function boot(base: string): Plugin {
  return {
    name: 'daum-boot',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const sizes = width();
        const style = read('boot.css')
          .replace('WIDTH_WIDE_D', sizes.wideD)
          .replace('WIDTH_WIDE', sizes.wide)
          .replace('WIDTH_TALL_D', sizes.tallD)
          .replace('WIDTH_TALL', sizes.tall);
        let page = html
          .replace('<html lang="zh-CN">', '<html lang="zh-CN" class="boot">')
          .replace('</head>', `  <style>${style}</style>\n  </head>`)
          .replace('<div id="root"></div>', `<div id="boot">${wordmark()}</div>\n    <div id="root"></div>`);

        // In dev the app comes in through Vite's own script tag; boot.js only waits for it.
        let config = 'null';
        const bundle = ctx.bundle;
        const entry = ctx.chunk;
        if (bundle && entry) {
          const styles: string[] = [];
          page = page
            .replace(/\s*<script type="module" crossorigin src="[^"]+"><\/script>/, '')
            .replace(/\s*<link rel="modulepreload" crossorigin href="[^"]+">/g, '')
            .replace(/\s*<link rel="stylesheet" crossorigin href="[^"]+">/g, '');
          for (const file of Object.values(bundle)) if (file.type === 'asset' && file.fileName.endsWith('.css')) styles.push(file.fileName);

          // Everything the opening needs: the app, the 3D scene (skipped where it cannot run),
          // their shared chunks, the styles and the Latin face of Outfit.
          const files = new Map<string, { size: number; scene: boolean }>();
          const chunk = (name: string) => {
            const c = bundle[name];
            return c && c.type === 'chunk' ? c : null;
          };
          const take = (name: string, scene: boolean) => {
            const c = chunk(name);
            if (!c || files.has(name)) return;
            files.set(name, { size: Buffer.byteLength(c.code), scene });
            for (const dep of c.imports) take(dep, scene);
          };
          take(entry.fileName, false);
          for (const name of entry.dynamicImports) take(name, true);
          for (const file of Object.values(bundle)) {
            if (file.type !== 'asset') continue;
            if (file.fileName.endsWith('.css') || /outfit-latin-wght.*\.woff2$/.test(file.fileName))
              files.set(file.fileName, { size: typeof file.source === 'string' ? Buffer.byteLength(file.source) : file.source.byteLength, scene: false });
          }
          config = JSON.stringify({
            base,
            fallback: '/',
            entry: entry.fileName,
            styles,
            files: [...files].map(([name, f]) => [name, f.size, f.scene ? 1 : 0]),
          });
          if (base.startsWith('http')) page = page.replace('</head>', `  <link rel="preconnect" href="${new URL(base).origin}" crossorigin />\n  </head>`);
        }
        return page.replace('</body>', `  <script>window.__BOOT = ${config};\nwindow.__MARK = ${mark()};\n${read('boot.js')}</script>\n  </body>`);
      },
    },
  };
}
