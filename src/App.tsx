import { gsap } from 'gsap';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Flat } from './sections/Flat';
import { Overlay, type OverlayHandle } from './sections/Overlay';
import { detectCapabilities, type Capabilities } from './lib/capabilities';
import { frame } from './lib/frame-store';
import { qiqiReady } from './lib/qiqi';
import { SCROLL_VH } from './lib/timeline';

const Stage = lazy(() => import('./scene/Stage'));

/** The longest the page waits for qiqi.help to settle, once its own picture is drawn. */
const QIQI_WAIT = 12000;

// Dev only: ?p=0.4 pins the page at that point of the timeline.
const pinned = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('p') ?? NaN) : NaN;

export function App() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const overlay = useRef<OverlayHandle>(null);

  useEffect(() => setCaps(detectCapabilities()), []);
  const use3d = caps !== null && caps.webgl2 && !caps.reducedMotion;

  // The static page is ready as soon as it is up (and keeps its scrollbar, see global.css);
  // the scene says so itself (onReady).
  useEffect(() => {
    if (!caps || use3d) return;
    document.documentElement.classList.add('flat');
    dispatchEvent(new Event('daum:ready'));
  }, [caps, use3d]);

  useEffect(() => {
    if (!use3d) return;
    const root = document.documentElement;
    const lenis = new Lenis({ autoRaf: false });
    // Held still until the loading screen (boot/boot.js) lets the page in.
    const enter = () => lenis.start();
    if (root.classList.contains('boot')) {
      lenis.stop();
      addEventListener('daum:enter', enter, { once: true });
    }
    const tick = (time: number) => {
      lenis.raf(time * 1000);
      const range = document.documentElement.scrollHeight - innerHeight;
      frame.progress = Number.isFinite(pinned) ? pinned : range > 0 ? Math.min(Math.max(lenis.scroll / range, 0), 1) : 0;
      overlay.current?.update(frame.progress);
    };
    gsap.ticker.add(tick, false, true);
    gsap.ticker.lagSmoothing(0);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      frame.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      frame.pointer.y = 1 - (e.clientY / innerHeight) * 2;
    };
    const toTop = () => lenis.scrollTo(0, { duration: 2.4 });
    addEventListener('pointermove', onMove);
    addEventListener('daum:top', toTop);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      removeEventListener('pointermove', onMove);
      removeEventListener('daum:top', toTop);
      removeEventListener('daum:enter', enter);
      root.classList.remove('gl');
    };
  }, [use3d]);

  // Let in once the first picture is drawn and qiqi.help, loading out of sight
  // from the start, has settled too, so it is never seen half loaded.
  const onReady = useCallback(() => {
    document.documentElement.classList.add('gl');
    const drawn = performance.now();
    const wait = () => {
      if (qiqiReady() || performance.now() - drawn > QIQI_WAIT) dispatchEvent(new Event('daum:ready'));
      else setTimeout(wait, 100);
    };
    wait();
  }, []);

  if (!caps) return null;
  if (!use3d) return <Flat />;
  return (
    <>
      <div className="spacer" style={{ height: `${SCROLL_VH}vh` }} />
      <Overlay ref={overlay} />
      <Suspense fallback={null}>
        <Stage dpr={Math.min(devicePixelRatio, 2)} onReady={onReady} />
      </Suspense>
    </>
  );
}
