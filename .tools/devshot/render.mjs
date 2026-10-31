// Runs on the owner's machine as the job's promo/render.mjs: serves the daum12569 site build that
// came along in stage/ on a local port, scrolls it to each asked progress and screenshots it.
// usage (via the worker): render.mjs --stills 0,0.84,0.9
// stage/target.json can name other pages to shoot instead ({ "urls": [...] }, top of each),
// other viewport sizes ({ "sizes": [[390, 844]] }) and ask for the loading screen too ({ "boot": true }).
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/chrome.mjs';

const stage = fileURLToPath(new URL('./stage/', import.meta.url));
const out = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(out, { recursive: true });

const i = process.argv.indexOf('--stills');
const stills = (i > 0 ? process.argv[i + 1] : '0').split(',').map(Number);
const SIZES = [[1440, 900]];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const name = path === '/' ? 'index.html' : basename(path);
  try {
    const body = readFileSync(stage + name);
    res.writeHead(200, { 'content-type': TYPES[extname(name)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = await launch({ mouse: false, webgl: true });
const target = existsSync(stage + 'target.json') ? JSON.parse(readFileSync(stage + 'target.json', 'utf8')) : null;
const BOOT = !!target?.boot;
try {
  await c.send('Page.enable');
  const sizes = target?.sizes ?? SIZES;
  for (const [n, page] of (target?.urls ?? []).entries()) {
    const [w, h] = sizes[0];
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.navigate', { url: page });
    await sleep(8000);
    const { data } = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    writeFileSync(out + `page-${n}.jpg`, Buffer.from(data, 'base64'));
    console.log('shot', page);
  }
  for (const [w, h] of target?.urls ? [] : sizes) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await c.send('Page.navigate', { url });
    for (const ms of BOOT ? [300, 800] : []) {
      await sleep(ms === 300 ? 300 : 500);
      const { data } = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
      writeFileSync(out + `${w}x${h}-boot-${ms}.jpg`, Buffer.from(data, 'base64'));
      console.log('shot', `boot ${ms} ms`);
    }
    let ready = false;
    for (let t = 0; t < 300 && !ready; t++) {
      await sleep(200);
      ready = await c.evaluate("document.documentElement.classList.contains('gl')").catch(() => false);
    }
    if (!ready) throw new Error('the scene never drew');
    console.log('gl', await c.evaluate("JSON.stringify((() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })())"));
    await sleep(3000);
    if (BOOT) console.log('after boot', await c.evaluate("JSON.stringify({ locked: document.documentElement.classList.contains('boot'), screen: !!document.getElementById('boot') })"));
    for (const p of stills) {
      await c.evaluate(`scrollTo(0, ${p} * (document.documentElement.scrollHeight - innerHeight))`);
      // Long enough for the live pages to load once they come near.
      await sleep(4000);
      const { data } = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
      const file = `${w}x${h}-${p}.jpg`;
      writeFileSync(out + file, Buffer.from(data, 'base64'));
      console.log('shot', file);
    }
  }
} finally {
  await c.close();
  server.close();
}
