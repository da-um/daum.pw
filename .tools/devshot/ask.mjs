// On lemon: sends the site build in ./site plus ./render.mjs to the render worker on the owner's
// machine (the qiqi.help render station, through its tunnel) and saves the screenshots it returns.
// usage: npx vite build --outDir .tools/devshot/site --emptyOutDir   (from site/, never touches dist/)
//        node .tools/devshot/ask.mjs 0,0.84,0.9   (progress values; pictures land in .tools/devshot/out/)
//        node .tools/devshot/ask.mjs --url https://qiqi.help/,https://example.com/   (other pages, as they open)
//        node .tools/devshot/ask.mjs 0.5,0.9 --size 390x844   (another viewport)
//        node .tools/devshot/ask.mjs 0,0.2 --boot   (also the loading screen on the way in)
import { request } from 'node:http';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const here = fileURLToPath(new URL('.', import.meta.url));
const HEADERS = { 'x-qiqi-worker': '1' };
const call = (port, method, path, body, timeout = 0) =>
  new Promise((done, fail) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { ...HEADERS, ...(body ? { 'content-type': 'application/json', 'content-encoding': 'gzip' } : {}) } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => done({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    if (timeout) req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.on('error', fail);
    req.end(body);
  });

let port = null;
for (let p = 7700; p < 7710 && !port; p++) {
  // a port left from a connection that died answers nothing, or nothing useful
  const hello = await call(p, 'GET', '/hello', null, 1500).catch(() => null);
  if (hello?.status === 200 && JSON.parse(hello.body).worker === 'qiqi-promo') port = p;
}
if (!port) throw new Error('no render worker: the render station is not running or is paused');

const files = {};
const add = (as, from) => (files[as] = readFileSync(from).toString('base64'));
add('promo/render.mjs', join(here, 'render.mjs'));
add('promo/lib/chrome.mjs', '/www/daum/qiqi.help/promo/lib/chrome.mjs');
add('promo/stage/index.html', join(here, 'site/index.html'));
add('promo/stage/favicon.svg', join(here, 'site/favicon.svg'));
for (const name of readdirSync(join(here, 'site/assets'))) add(`promo/stage/${name}`, join(here, 'site/assets', name));
const urls = process.argv[2] === '--url' ? process.argv[3].split(',') : null;
const at = process.argv.indexOf('--size');
const sizes = at > 0 ? [process.argv[at + 1].split('x').map(Number)] : null;
const boot = process.argv.includes('--boot');
if (urls || sizes || boot) files['promo/stage/target.json'] = Buffer.from(JSON.stringify({ urls, sizes, boot })).toString('base64');

const t0 = Date.now();
const res = await call(port, 'POST', '/job', gzipSync(JSON.stringify({ type: 'render', files, args: ['--stills', urls ? '0' : (process.argv[2] ?? '0')] })));
if (res.status !== 200) throw new Error(`worker answered ${res.status}: ${res.body.toString().slice(0, 300)}`);
const reply = JSON.parse(gunzipSync(res.body));
console.log(reply.log.trim().split('\n').slice(-12).join('\n'));
const dir = join(here, 'out', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(dir, { recursive: true });
for (const [path, data] of Object.entries(reply.files)) {
  writeFileSync(join(dir, path.split('/').pop()), Buffer.from(data, 'base64'));
  console.log(join(dir, path.split('/').pop()));
}
console.log(`${reply.ok ? 'done' : 'failed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
