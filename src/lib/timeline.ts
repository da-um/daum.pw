// Scroll timeline for the whole page, as fractions of total scroll.

export type Span = readonly [number, number];

/** Page height in viewport heights. */
export const SCROLL_VH = 1100;

export const T = {
  /** Wordmark parts, the page opens. */
  open: [0.012, 0.09],
  /** Camera flies through the layers, as soon as the wordmark parts, to the star map. */
  dive: [0.012, 0.3],
  /** ...and keeps easing in on it while it draws and gathers. */
  ease: [0.3, 0.54],
  /** Star map draws itself as the camera arrives. Read until gather. */
  stars: [0.235, 0.33],
  /** Stars gather into qiqi.help's page, live. Read until pass. */
  gather: [0.42, 0.5],
  /**
   * qiqi.help's page fades in its frame, a window now onto daumini's
   * whiteboard, and the camera flies through it, easing up to the board.
   */
  pass: [0.56, 0.69],
  /** A pen draws a frame on the whiteboard, seen through the window at first... */
  draw: [0.585, 0.665],
  /** ...and daumini's own page comes into it, whole, as the camera arrives (in time, see Daumini). Read until end. */
  fill: [0.665, 0.775],
  /** The ending: the page-colored plates leave (behind the camera, as it turns back), and the name lines up. */
  end: [0.835, 0.985],
  /** Camera backs out the way it came, through the character plates, to face the name. */
  back: [0.835, 0.96],
  /** ...threading the tunnel's plates in this stretch... */
  out: [0.866, 0.905],
  /**
   * The character plates take the wordmark's color only once the camera is far
   * enough back that none of them fills the screen (a third of its height at most)...
   */
  tint: [0.945, 0.965],
  /** ...then, once the camera is out of the tunnel, swing into a row that spells the name. */
  line: [0.905, 0.975],
} as const satisfies Record<string, Span>;

export const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
export const span = (p: number, s: Span) => clamp01((p - s[0]) / (s[1] - s[0]));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** CSS cubic-bezier as a function of x. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const f = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (f(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return f(y1, y2, (lo + hi) / 2);
  };
}

/** The brand curve, cubic-bezier(0.7, 0, 0.2, 1). */
export const snap = bezier(0.7, 0, 0.2, 1);
