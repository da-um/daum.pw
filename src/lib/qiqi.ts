import { frame } from './frame-store';

// qiqi.help, embedded with ?embed=daum12569, opens at its star map and says
// where its frame, every star, line and nation name sit in its window (qiqi.help
// src/lib/embed.ts), so the scene can draw that very map and carry it into place.

const ORIGIN = 'https://qiqi.help';

export interface QiqiStars {
  /** its window, in CSS px */
  w: number;
  h: number;
  /** its star map's frame in the window */
  frame: { x: number; y: number; w: number; h: number };
  stars: { g: string; x: number; y: number; five: boolean }[];
  /** the constellations' lines, as pairs of indices into `stars` */
  lines: [number, number][];
  /** each nation's name: centre x and top y in the window, and its font size */
  nations: { id: string; zh: string | null; x: number; y: number; size: number }[];
}

addEventListener('message', (e) => {
  if (e.origin !== ORIGIN) return;
  const d = e.data as ({ type?: string } & QiqiStars) | null;
  if (d?.type === 'qiqi:ready') frame.qiqiReady = true;
  if (d?.type === 'qiqi:stars' && d.frame && Array.isArray(d.stars) && Array.isArray(d.lines) && Array.isArray(d.nations)) frame.qiqi = d;
});

/** Whether the live qiqi.help can be shown: it has said it settled, or it loaded a while ago and said nothing. */
export const qiqiReady = () => frame.qiqiReady || (frame.qiqiLoaded > 0 && performance.now() - frame.qiqiLoaded > 8000);

/** asks the embedded qiqi.help where things are now; the answer lands in frame.qiqi */
export function askQiqi() {
  const win = frame.dom.live.qiqi?.querySelector('iframe')?.contentWindow;
  win?.postMessage({ type: 'daum12569:stars?' }, ORIGIN);
}
