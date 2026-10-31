import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { ShapeGeometry, type Group } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { BRAND_BOUNDS, BRAND_PATHS } from '../data/brand-glyph';
import { frame } from '../lib/frame-store';
import { MARK_LAYERS as LAYERS, MARK_REST, MARK_SINK, MARK_STEP as STEP, MARK_W, markShade } from '../lib/mark';
import { FACE } from '../lib/palette';
import { T, snap, span } from '../lib/timeline';
import { flatMaterial } from './materials';

// The wordmark is a stack of flat cut-outs, each a step lighter, fanned out
// away from the pointer like a long flat shadow. The front one carries the
// wordmark's own gradient from neu.css; the ones behind melt into the page.
// The loading screen flies this same picture together and hands over to it,
// so it starts out whole and at rest.

function glyphGeometry(from: number, to: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${BRAND_PATHS.slice(from, to)
    .map((d) => `<path d="${d}"/>`)
    .join('')}</svg>`;
  const shapes = new SVGLoader().parse(svg).paths.flatMap((p) => p.toShapes());
  const geo = new ShapeGeometry(shapes, 10);
  const s = MARK_W / BRAND_BOUNDS.w;
  // Font units (y up) -> world, centered on the origin.
  geo.translate(-(BRAND_BOUNDS.x + BRAND_BOUNDS.w / 2), -(BRAND_BOUNDS.y + BRAND_BOUNDS.h / 2), 0);
  geo.scale(s, s, 1);
  return geo;
}

export function Wordmark() {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const root = useRef<Group>(null);

  const { geoL, geoR, mats } = useMemo(() => {
    return {
      geoL: glyphGeometry(0, 4),
      geoR: glyphGeometry(4, 9),
      mats: Array.from({ length: LAYERS }, (_, i) =>
        i === 0 ? flatMaterial(FACE[0], { box: { x: -MARK_W / 2, w: MARK_W }, from: FACE[0], to: FACE[1] }) : flatMaterial(markShade(i)),
      ),
    };
  }, []);
  useEffect(
    () => () => {
      geoL.dispose();
      geoR.dispose();
      mats.forEach((m) => m.dispose());
    },
    [geoL, geoR, mats],
  );

  const dir = useRef({ ...MARK_REST });

  useFrame((_, dt) => {
    const p = frame.progress;
    const open = snap(span(p, T.open));
    const g = root.current;
    if (!g || !left.current || !right.current) return;
    g.visible = open < 0.999;

    // The layers fall away from the pointer, like a shadow from a lamp in your hand.
    // Eased even on the first frame, so the hand-over from the loading screen is still.
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 5);
    const px = -frame.pointer.x * 0.9 + MARK_REST.x * (1 - Math.abs(frame.pointer.x));
    const py = -frame.pointer.y * 0.9 + MARK_REST.y * (1 - Math.abs(frame.pointer.y));
    const len = Math.hypot(px, py) || 1;
    dir.current.x += (px / len - dir.current.x) * k;
    dir.current.y += (py / len - dir.current.y) * k;
    const fan = STEP * (1 + open * 9);

    for (const [side, sign] of [
      [left.current, -1],
      [right.current, 1],
    ] as const) {
      side.children.forEach((m, i) => {
        // Opening: the halves part, deeper layers trailing behind.
        const x = sign * open * (MARK_W * 0.95 + i * 40) + dir.current.x * i * fan;
        m.position.set(x, dir.current.y * i * fan, -i * MARK_SINK);
      });
    }
  });

  const layers = (geo: ShapeGeometry) =>
    mats.map((mat, i) => <mesh key={i} geometry={geo} material={mat} renderOrder={LAYERS - i} />);

  return (
    <group ref={root}>
      <group ref={left}>{layers(geoL)}</group>
      <group ref={right}>{layers(geoR)}</group>
    </group>
  );
}

