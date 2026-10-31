import { CatmullRomCurve3, Vector3 } from 'three';

// The camera's way as one smooth track: where to be and what to look at,
// station by station, and when (as scroll progress) to pass which station.
// In between, the speed changes smoothly and never stops dead, so no stretch
// of scrolling cuts to another shot.

export interface Station {
  pos: Vector3;
  look: Vector3;
}

/**
 * A monotone cubic through (x, y) knots, at rest at both ends: the slope
 * changes smoothly and never runs backwards or past a knot (Fritsch–Butland).
 */
export function monotone(knots: readonly (readonly [number, number])[]) {
  const x = knots.map((k) => k[0]);
  const y = knots.map((k) => k[1]);
  const n = knots.length;
  const h = x.slice(1).map((v, i) => v - x[i]!);
  const d = h.map((w, i) => (y[i + 1]! - y[i]!) / w);
  const m = x.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    const [a, b] = [d[i - 1]!, d[i]!];
    if (a * b <= 0) return 0;
    const [wa, wb] = [2 * h[i]! + h[i - 1]!, h[i]! + 2 * h[i - 1]!];
    return (wa + wb) / (wa / a + wb / b);
  });
  return (t: number) => {
    if (t <= x[0]!) return y[0]!;
    if (t >= x[n - 1]!) return y[n - 1]!;
    let i = 0;
    while (t > x[i + 1]!) i++;
    const s = (t - x[i]!) / h[i]!;
    const [s2, s3] = [s * s, s * s * s];
    return (2 * s3 - 3 * s2 + 1) * y[i]! + (s3 - 2 * s2 + s) * h[i]! * m[i]! + (3 * s2 - 2 * s3) * y[i + 1]! + (s3 - s2) * h[i]! * m[i + 1]!;
  };
}

const PER = 64;

export class Rail {
  private readonly pos: CatmullRomCurve3;
  private readonly look: CatmullRomCurve3;
  private readonly travel: (p: number) => number;

  /** `knots`: [progress, station index], in order, the first and last at rest. */
  constructor(stations: readonly Station[], knots: readonly (readonly [number, number])[]) {
    this.pos = new CatmullRomCurve3(stations.map((s) => s.pos), false, 'centripetal');
    this.look = new CatmullRomCurve3(stations.map((s) => s.look), false, 'centripetal');
    // Station i sits at t = i / (n - 1) on both curves, and at lengths[i * PER].
    this.pos.arcLengthDivisions = (stations.length - 1) * PER;
    const lengths = this.pos.getLengths();
    this.travel = monotone(knots.map(([p, i]) => [p, lengths[i * PER]!] as const));
  }

  /** Where the camera is at progress p, and the point it looks at. */
  at(p: number, pos: Vector3, look: Vector3) {
    // By distance along the track (at 0 it falls back to u, also 0).
    const t = this.pos.getUtoTmapping(0, this.travel(p));
    this.pos.getPoint(t, pos);
    this.look.getPoint(t, look);
  }
}
