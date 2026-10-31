// The loading screen (boot/plugin.ts writes this into index.html). It plays
// the opening: the wordmark's layers fly in from all round and settle into
// the stack, the deepest first and the face last, keeping pace with the
// page's files as they arrive. Once they are all in, the app starts from the
// cache and draws the same picture underneath, the screen steps aside, and
// only then can the page be scrolled.
(() => {
  const root = document.documentElement;
  const screen = document.getElementById('boot');
  if (!screen) return;
  const config = window.__BOOT;
  const mark = window.__MARK;
  const { intro } = mark;
  const layers = [...screen.querySelectorAll('use')].map((el) => ({ el, i: Number(el.dataset.i) }));
  const deepest = mark.layers - 1;
  // When the face lands, in seconds: the whole opening, even from the cache.
  const END = intro.delay + deepest * intro.stagger + intro.flight;
  // Never keep anyone out longer than this, whatever went wrong.
  const LONGEST = 45000;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAN = Math.tan(((mark.fov / 2) * Math.PI) / 180);
  const [cx, cy] = mark.center;
  const start = performance.now();
  let last = start;
  let clock = 0;
  let got = 0;
  let total = 0;
  let ready = false;
  let gone = false;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  // The app says so once its first picture is drawn (src/App.tsx).
  addEventListener('daum:ready', () => (ready = true), { once: true });

  const clamp = (t) => Math.min(1, Math.max(0, t));
  // The brand curve, cubic-bezier(0.7, 0, 0.2, 1) (src/lib/timeline.ts snap).
  const curve = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  function snap(x) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (curve(0.7, 0.2, mid) < x) lo = mid;
      else hi = mid;
    }
    return curve(0, 1, (lo + hi) / 2);
  }

  // Each layer where the scene's camera would see it (src/scene/Wordmark.tsx, world.ts):
  // perspective from the opening's camera distance, world units to the SVG's.
  function place() {
    const aspect = innerWidth / innerHeight;
    const dist = Math.max(mark.w / (aspect < 1 ? mark.fit.tall : mark.fit.wide) / (2 * TAN * aspect), mark.h / mark.fit.height / (2 * TAN));
    for (const { el, i } of layers) {
      const o = still ? 1 : clamp((clock - intro.delay - (deepest - i) * intro.stagger) / intro.flight);
      const d = snap(o);
      const angle = i * intro.spread;
      const r = (1 - d) * intro.reach;
      const x = mark.rest.x * i * mark.step + Math.cos(angle) * r;
      const y = mark.rest.y * i * mark.step + Math.sin(angle) * r * intro.squash;
      const s = dist / (dist + i * mark.sink - (1 - d) * intro.depth);
      const turn = (((1 - d) * (i % 2 ? intro.turn : -intro.turn)) * 180) / Math.PI;
      // SVG y points down, so the turn flips too.
      el.setAttribute('transform', `translate(${cx + x * s * mark.unit} ${cy - y * s * mark.unit}) rotate(${-turn}) scale(${s}) translate(${-cx} ${-cy})`);
      el.setAttribute('opacity', String(Math.min(1, o * 4)));
    }
  }

  function leave() {
    if (gone) return;
    gone = true;
    screen.classList.add('out');
    root.classList.remove('boot');
    dispatchEvent(new Event('daum:enter'));
    setTimeout(() => screen.remove(), 400);
  }

  function tick(now) {
    if (gone) return;
    // In dev there is nothing to count: wait just short of the end for the app.
    const loaded = config ? (total ? Math.min(1, got / total) : 0) : ready ? 1 : 0.92;
    // Real time, but no further than the download allows: the layers come in as the page does.
    const dt = Math.min(now - last, 100) / 1000;
    last = now;
    clock = Math.min(clock + dt, Math.max(clock, intro.delay + loaded * (END - intro.delay)));
    place();
    if ((ready && (still || clock >= END)) || now - start > LONGEST) return leave();
    requestAnimationFrame(tick);
  }
  place();
  requestAnimationFrame(tick);
  if (!config) return;

  // The 3D scene is only fetched where it will run (as src/lib/capabilities.ts decides).
  let scene = !still;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    scene &&= gl !== null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    scene = false;
  }

  async function pull(url, size) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok || !res.body) throw new Error(`${res.status} ${url}`);
    const reader = res.body.getReader();
    let mine = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      mine += value.length;
      got += value.length;
    }
    got += Math.max(0, size - mine);
  }

  // Everything into the cache first, counting; then the styles and the app, from there.
  async function load(base) {
    const files = config.files.filter(([, , onlyScene]) => scene || !onlyScene);
    got = 0;
    total = files.reduce((n, [, size]) => n + size, 0);
    await Promise.all(files.map(([name, size]) => pull(base + name, size)));
    for (const name of config.styles) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.crossOrigin = 'anonymous';
      link.href = base + name;
      document.head.append(link);
    }
    await import(base + config.entry);
  }

  // The files live on lu1; this server keeps a copy in case lu1 cannot be reached.
  load(config.base)
    .catch(() => load(config.fallback))
    .catch(leave);
})();
