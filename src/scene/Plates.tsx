import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Path, PlaneGeometry, Shape, ShapeGeometry, Vector2, Vector3, type Group, type Mesh } from 'three';
import { frame } from '../lib/frame-store';
import { MARK_LAYERS, MARK_REST, markShade } from '../lib/mark';
import { WASH, face } from '../lib/palette';
import { T, clamp01, easeInOut, lerp, smooth, snap, span } from '../lib/timeline';
import { glyphs, type Glyph } from './glyphs';
import { flatMaterial, plateMaterial } from './materials';
import { CUT, GLYPH_SCALE, PLATE_SIZE, WASH_SPAN, cardOf, type World } from './world';

const plane = new PlaneGeometry(1, 1);
/**
 * The cut runs back through the opening wordmark's layers (world.ts CUT),
 * slanting down and right as its long shadow does, the face first and each
 * one behind a shade lighter: each character reads as a solid shape, in true
 * perspective. In the stack at the end the cut goes straight, and only this deep.
 */
const STACK_CUT = 60;
/** In the stack, a line of the page around each card, where it lies on the next. */
const KEYLINE = 22;

/** A card with one character cut out; the character's counters stay as islands. */
function cardGeometry(g: Glyph) {
  const s = GLYPH_SCALE;
  const { x, y, w, h } = cardOf(g);
  const card = new Shape([new Vector2(x, y), new Vector2(x + w, y), new Vector2(x + w, y + h), new Vector2(x, y + h)]);
  const islands: Shape[] = [];
  for (const shape of g.shapes) {
    card.holes.push(new Path(shape.getPoints().map((p) => p.clone().multiplyScalar(s))));
    for (const hole of shape.holes) islands.push(new Shape(hole.getPoints().map((p) => p.clone().multiplyScalar(s))));
  }
  return new ShapeGeometry([card, ...islands]);
}

/** The walls of the cut, running back from the card's face: a band per layer, each its own group. */
function rimGeometry(g: Glyph) {
  const s = GLYPH_SCALE;
  const step = CUT.depth / MARK_LAYERS;
  const rings = g.shapes.flatMap((shape) => [shape.getPoints(), ...shape.holes.map((h) => h.getPoints())]);
  const pos: number[] = [];
  const geo = new BufferGeometry();
  for (let layer = 0; layer < MARK_LAYERS; layer++) {
    const [z0, z1] = [-layer * step, -(layer + 1) * step];
    const start = pos.length / 3;
    for (const ring of rings)
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length]!;
        const [ax, ay, bx, by] = [a.x * s, a.y * s, b.x * s, b.y * s];
        pos.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1);
      });
    geo.addGroup(start, pos.length / 3 - start, layer);
  }
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return geo;
}

/** The page behind the wordmark, then one plate per character of the name. */
export function Plates({ world }: { world: World }) {
  const gl = useThree((s) => s.gl);
  const page = useRef<Mesh>(null);
  const groups = useRef<(Group | null)[]>([]);
  const outers = useRef<(Mesh | null)[]>([]);
  const keys = useRef<(Mesh | null)[]>([]);
  const walls = useRef<(Mesh | null)[]>([]);

  const res = useMemo(() => {
    const pageMat = plateMaterial();
    const cards = glyphs().map(cardGeometry);
    const rims = glyphs().map(rimGeometry);
    // The wordmark's face runs across the whole name, each character taking
    // its own stretch of it: on the front of the cut walls in the tunnel, and
    // on the cards once they line up. Behind it, the shadow's layers.
    const n = world.tunnel.length;
    const shades = Array.from({ length: MARK_LAYERS - 1 }, (_, i) => flatMaterial(markShade(i + 1)));
    const rimMats = glyphs().map((g, i) => {
      const w = g.w * GLYPH_SCALE;
      return flatMaterial(face(i / n), { box: { x: -w / 2, w }, from: face(i / n), to: face((i + 1) / n) });
    });
    [...shades, ...rimMats].forEach((m) => (m.side = DoubleSide));
    const frames = world.tunnel.map(() => plateMaterial());
    const outer = world.tunnel.map(() => plateMaterial());
    const keyMats = world.tunnel.map(() => plateMaterial());
    const from = world.tunnel.map((plate) => new Vector3(plate.x, plate.y, plate.z));
    const rects = glyphs().map(cardOf);
    return { pageMat, cards, rims, rimMats, shades, frames, outer, keyMats, from, rects };
  }, [world]);
  useEffect(
    () => () => {
      res.pageMat.dispose();
      [...res.cards, ...res.rims].forEach((g) => g.dispose());
      [...res.rimMats, ...res.shades, ...res.frames, ...res.outer, ...res.keyMats].forEach((m) => m.dispose());
    },
    [res],
  );

  useFrame(() => {
    const p = frame.progress;
    const iris = snap(span(p, T.open));
    const end = easeInOut(span(p, T.end));
    const tint = smooth(span(p, T.tint));

    // The page: the CSS background in screen space. Its hole opens like an
    // iris as the wordmark parts. The page-colored plates leave as soon as the
    // line-up starts: the CSS page behind is the same color, so nothing jumps,
    // and nothing half-faded is left to veil or hide the cards.
    if (page.current) {
      const u = res.pageMat.uniforms;
      page.current.scale.set(PLATE_SIZE, PLATE_SIZE, 1);
      page.current.position.z = world.pageZ;
      u.uSize!.value.set(PLATE_SIZE, PLATE_SIZE);
      u.uWash!.value = WASH;
      u.uScreen!.value = 1;
      gl.getDrawingBufferSize(u.uRes!.value);
      const r = iris * 3000;
      u.uHole!.value.set(r, r);
      u.uRadius!.value = r;
      page.current.visible = end <= 0;
    }

    world.tunnel.forEach((plate, i) => {
      const g = groups.current[i];
      const outer = outers.current[i];
      const key = keys.current[i];
      if (!g || !outer || !key) return;
      g.visible = iris > 0 || end > 0;
      // Later characters set off a little later, so the name assembles in order.
      const e = easeInOut(clamp01(span(p, T.line) * 1.3 - i * 0.0375));
      g.position.lerpVectors(res.from[i]!, world.stack.slots[i]!, e);
      // The slant as a shear: x and y move with depth (z runs negative into the card).
      const wall = walls.current[i];
      if (wall) {
        const k = (-CUT.slant / CUT.depth) * (1 - e);
        wall.matrix.set(1, 0, MARK_REST.x * k, 0, 0, 1, MARK_REST.y * k, 0, 0, 0, lerp(1, STACK_CUT / CUT.depth, e), 0, 0, 0, 0, 1);
        wall.matrixWorldNeedsUpdate = true;
      }

      // In the tunnel every plate is the page itself; once the camera has
      // backed out past them, the cards take the wordmark's face.
      const card = res.rects[plate.glyph]!;
      const f = res.frames[i]!.uniforms;
      f.uWash!.value = WASH;
      f.uGradSpan!.value = WASH_SPAN;
      const n = world.tunnel.length;
      f.uTintFrom!.value.set(...face(i / n));
      f.uTintTo!.value.set(...face((i + 1) / n));
      f.uTintBox!.value = [card.x, card.y + card.h, card.w, card.h];
      f.uTintMix!.value = tint;

      // Filler around the card, so the plate covers the view.
      const o = res.outer[i]!.uniforms;
      outer.scale.set(PLATE_SIZE, PLATE_SIZE, 1);
      outer.visible = end <= 0;
      o.uSize!.value.set(PLATE_SIZE, PLATE_SIZE);
      o.uWash!.value = WASH;
      o.uGradSpan!.value = WASH_SPAN;
      o.uHole!.value.set(card.w / 2 - 1, card.h / 2 - 1);
      o.uHoleOff!.value.set(card.x + card.w / 2, card.y + card.h / 2);
      o.uRadius!.value = 0;

      // A ring of the page between a card and the next one behind it, once they have color.
      const k = res.keyMats[i]!.uniforms;
      key.visible = tint > 0;
      key.scale.set(card.w + 2 * KEYLINE, card.h + 2 * KEYLINE, 1);
      key.position.set(card.x + card.w / 2, card.y + card.h / 2, -world.stack.depth / 2);
      k.uSize!.value.set(card.w + 2 * KEYLINE, card.h + 2 * KEYLINE);
      k.uHole!.value.set(card.w / 2 - 1, card.h / 2 - 1);
      k.uWash!.value = WASH;
      k.uScreen!.value = 1;
      gl.getDrawingBufferSize(k.uRes!.value);
    });
  });

  return (
    <>
      <mesh ref={page} geometry={plane} material={res.pageMat} />
      {world.tunnel.map((plate, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          <mesh geometry={res.cards[plate.glyph]} material={res.frames[i]} />
          <mesh
            ref={(el) => {
              walls.current[i] = el;
            }}
            geometry={res.rims[plate.glyph]}
            material={[res.rimMats[plate.glyph]!, ...res.shades]}
            matrixAutoUpdate={false}
          />
          <mesh
            ref={(el) => {
              outers.current[i] = el;
            }}
            geometry={plane}
            material={res.outer[i]}
            position-z={-0.4}
          />
          <mesh
            ref={(el) => {
              keys.current[i] = el;
            }}
            geometry={plane}
            material={res.keyMats[i]}
          />
        </group>
      ))}
    </>
  );
}
