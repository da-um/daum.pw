import { Shape, Vector2 } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { BRAND_PATHS } from '../data/brand-glyph';

/** One character of the wordmark, in font units, centered on its box. */
export interface Glyph {
  shapes: Shape[];
  w: number;
  h: number;
  /** The point deepest inside the strokes: where the camera threads through. */
  pole: Vector2;
  /** Where the baseline runs, in the same coordinates. */
  base: number;
}

let cache: Glyph[] | null = null;

export function glyphs(): Glyph[] {
  if (cache) return cache;
  const loader = new SVGLoader();
  cache = BRAND_PATHS.map((d) => {
    const raw = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`).paths.flatMap((p) => p.toShapes());
    const pts = raw.flatMap((s) => s.getPoints());
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const shapes = raw.map((s) => {
      const out = new Shape(s.getPoints(12).map((p) => new Vector2(p.x - cx, p.y - cy)));
      out.holes = s.holes.map((h) => new Shape(h.getPoints(12).map((p) => new Vector2(p.x - cx, p.y - cy))));
      return out;
    });
    return {
      shapes,
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
      pole: pole(shapes),
      base: -cy,
    };
  });
  return cache;
}

/** Grid search for the inside point farthest from any edge. */
function pole(shapes: Shape[]): Vector2 {
  const rings = shapes.flatMap((s) => [s.getPoints(), ...s.holes.map((h) => h.getPoints())]);
  const all = rings.flat();
  const x0 = Math.min(...all.map((p) => p.x));
  const x1 = Math.max(...all.map((p) => p.x));
  const y0 = Math.min(...all.map((p) => p.y));
  const y1 = Math.max(...all.map((p) => p.y));
  const inside = (x: number, y: number) => {
    let c = false;
    for (const r of rings)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[i]!;
        const b = r[j]!;
        if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
      }
    return c;
  };
  const edge = (x: number, y: number) => {
    let best = Infinity;
    for (const r of rings)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[i]!;
        const b = r[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
      }
    return best;
  };
  let best = new Vector2();
  let bestD = -1;
  for (let x = x0; x <= x1; x += 10)
    for (let y = y0; y <= y1; y += 10) {
      if (!inside(x, y)) continue;
      const d = edge(x, y);
      if (d > bestD) {
        bestD = d;
        best = new Vector2(x, y);
      }
    }
  return best;
}
