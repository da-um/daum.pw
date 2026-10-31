import type { QiqiStars } from './qiqi';

// Values that change every frame. Input and scroll handlers write them,
// useFrame reads them; they never go through React state.
export const frame = {
  /** Smoothed scroll through the whole page, 0..1. */
  progress: 0,
  /** Mouse position, -1..1 from the viewport center, y up. Stays 0 on touch. */
  pointer: { x: 0, y: 0 },
  /** Seconds since the scene first rendered; drives the opening. */
  time: 0,
  /** performance.now() when the scene first rendered, 0 before that. */
  start: 0,
  /** Where the embedded qiqi.help's stars and nation names are, once it has said (lib/qiqi.ts). */
  qiqi: null as QiqiStars | null,
  /** It has said it settled (lib/qiqi.ts); and when its frame loaded, 0 before. */
  qiqiReady: false,
  qiqiLoaded: 0,
  /** DOM nodes the scene positions every frame. */
  dom: {
    labels: [] as HTMLElement[],
    /** The live pages, pinned onto their rectangles in the scene. */
    live: { qiqi: null as HTMLElement | null, daumini: null as HTMLElement | null },
  },
};
