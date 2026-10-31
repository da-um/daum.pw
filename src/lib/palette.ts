// Brand colors from daum110715/daum.pw src/styles/neu.css.
// Kept as sRGB triples: the canvas renders without color conversion,
// so these come out exactly as CSS shows them.

export type RGB = [number, number, number];

export const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const C = {
  cream: hex('#fcfaf6'),
  ink: hex('#44403c'),
  dim: hex('#78716c'),
  amber: hex('#f59e0b'),
  orange: hex('#fb923c'),
};

/** Strength of the 135° amber -> orange wash over cream, as in neu.css. */
export const WASH = 0.05;

// Everything colored on the page takes its color from the opening wordmark:
// its face for names and titles, its long shadow for the small things.

/** The wordmark's face, as in neu.css: amber to orange, each mixed 55% with white, left to right. */
export const FACE: [RGB, RGB] = [mix([1, 1, 1], C.amber, 0.55), mix([1, 1, 1], C.orange, 0.55)];

/** A point along the face's gradient, 0 at the left end of the name, 1 at the right. */
export const face = (t: number): RGB => mix(FACE[0], FACE[1], t);

/** The page color at a point along the 135° wash, for a given wash strength. */
export const washed = (strength: number, t: number): RGB => mix(C.cream, mix(C.amber, C.orange, t), strength);

/**
 * A step of the wordmark's long shadow: 0 is the layer right behind the face,
 * 1 has all but melted into the page. t picks amber or orange, as on the page.
 */
export const shade = (k: number, t = 0.5): RGB => washed(0.36 + (WASH + 0.02 - 0.36) * k, t);

/**
 * daumini's own colors (daumini web/src/app.css): its section is drawn in its
 * hand, a whiteboard sketch, so it takes them instead of the wordmark's.
 */
export const SKETCH = {
  paper: hex('#ffffff'),
  dots: hex('#e3e6ea'),
  ink: hex('#1e1e1e'),
  /** The second, finer stroke of a drawn line. */
  ink2: hex('#868e96'),
  /** The red pen. */
  mark: hex('#e03131'),
};

/**
 * qiqi.help's own colors (qiqi.help src/styles/base.css, light theme): its
 * section is drawn as its star map is, ink on warm paper, so it takes them.
 */
export const QIQI = {
  paper: hex('#fcfbfa'),
  ink: hex('#2b2430'),
  line: hex('#dccbe4'),
};
