import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
} from 'three';
import { frame } from '../lib/frame-store';
import { C, SKETCH, WASH, mix, type RGB } from '../lib/palette';
import { seeded } from '../lib/random';
import { T, smooth, span } from '../lib/timeline';
import { pin, show } from './live';
import { TAN, type World } from './world';

// daumini, drawn in its own hand. Behind qiqi.help's page lies a whiteboard,
// dotted, in daumini's colors. A pen draws a frame on it, and daumini's page
// comes into the frame, whole and live: the page lies under the scene, and the
// board over it thins away. Turning back for the name, all of it fades into the
// page color again.

/** As daumini's whiteboard, in CSS px as seen from the reading place: dot spacing and radius. */
const DOT_STEP = 22;
const DOT_R = 1.2;
/** The frame, in CSS px likewise: its margin round the page, corner radius, and the two strokes' widths. */
const FRAME = { margin: 16, radius: 10, ink: 2.6, ink2: 1.6 };
/** Seconds the page takes to come in, whatever the scrolling. */
const COME_IN = 0.45;

const v3 = (c: RGB) => new Vector3(...c);

// The page color, as CSS paints it (see plateMaterial), for fading back to it.
const pageColor = /* glsl */ `
  uniform vec3 uCream, uAmber, uOrange;
  uniform float uWash, uSketch;
  uniform vec2 uRes;
  vec3 pageColor() {
    vec2 f = gl_FragCoord.xy;
    float t = clamp(0.5 + (f.x - uRes.x * 0.5 + uRes.y * 0.5 - f.y) / (uRes.x + uRes.y), 0.0, 1.0);
    return mix(uCream, mix(uAmber, uOrange, t), uWash);
  }
`;

const pageUniforms = () => ({
  uCream: { value: v3(C.cream) },
  uAmber: { value: v3(C.amber) },
  uOrange: { value: v3(C.orange) },
  uWash: { value: WASH },
  uSketch: { value: 1 },
  uRes: { value: new Vector2(1, 1) },
});

/**
 * The board. Opaque, so over the page it can thin the canvas itself away and
 * the page under the scene shows (three draws opaque materials without
 * blending).
 */
function boardMaterial() {
  return new ShaderMaterial({
    uniforms: {
      ...pageUniforms(),
      uPaper: { value: v3(SKETCH.paper) },
      uDots: { value: v3(SKETCH.dots) },
      uStep: { value: 40 },
      uDotR: { value: 2 },
      uHalf: { value: new Vector2(1, 1) },
      uReveal: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${pageColor}
      uniform vec3 uPaper, uDots;
      uniform float uStep, uDotR, uReveal;
      uniform vec2 uHalf;
      varying vec2 vPos;

      void main() {
        vec2 g = vPos - uStep * floor(vPos / uStep + 0.5);
        float px = length(fwidth(vPos)) * 0.7;
        float d = 1.0 - smoothstep(uDotR - px, uDotR + px, length(g));
        // Dots too small to draw cleanly fade out rather than shimmer.
        d *= clamp((uDotR / px - 0.4) * 1.5, 0.0, 1.0);
        vec3 c = mix(pageColor(), mix(uPaper, uDots, d), uSketch);
        // Over the page it thins away, whole, to the page beneath (the canvas is
        // premultiplied: this lays it over what is under the scene).
        float a = abs(vPos.x) < uHalf.x && abs(vPos.y) < uHalf.y ? 1.0 - uReveal : 1.0;
        gl_FragColor = vec4(c * a, a);
      }
    `,
  });
}

/** Pen strokes, drawn up to uDraw (their aT runs 0..1 in drawing order). */
function inkMaterial() {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: { ...pageUniforms(), uDraw: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aT;
      attribute vec3 aColor;
      varying float vT;
      varying vec3 vColor;
      void main() {
        vT = aT;
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${pageColor}
      uniform float uDraw;
      varying float vT;
      varying vec3 vColor;
      void main() {
        if (vT > uDraw) discard;
        gl_FragColor = vec4(mix(pageColor(), vColor, uSketch), 1.0);
      }
    `,
  });
}

/**
 * A line drawn by hand round a w x h rectangle centered on 0, as daumini's
 * frames are: each side bowing a little, the corners rounded, the end running
 * on past the start.
 */
function penLoop(w: number, h: number, r: number, bow: number, over: number, rand: () => number) {
  const pts: Vector2[] = [];
  const corners = [
    [w / 2 - r, h / 2 - r],
    [w / 2 - r, -h / 2 + r],
    [-w / 2 + r, -h / 2 + r],
    [-w / 2 + r, h / 2 - r],
  ] as const;
  // Sides run from the end of one corner's arc to the start of the next; the arcs turn clockwise.
  const startAngle = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
  for (let side = 0; side < 4; side++) {
    const [ax, ay] = corners[(side + 3) % 4]!;
    const [bx, by] = corners[side]!;
    const a0 = startAngle[(side + 3) % 4]! - Math.PI / 2;
    const a1 = startAngle[side]!;
    const from = new Vector2(ax + Math.cos(a0) * r, ay + Math.sin(a0) * r);
    const to = new Vector2(bx + Math.cos(a1) * r, by + Math.sin(a1) * r);
    const n = new Vector2(to.y - from.y, from.x - to.x).normalize();
    const b = (rand() - 0.5) * 2 * bow;
    const lean = (rand() - 0.5) * bow;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(from.clone().lerp(to, t).addScaledVector(n, Math.sin(Math.PI * t) * b + (t - 0.5) * lean));
    }
    for (let i = 1; i < 8; i++) {
      const a = a1 - (i / 8) * (Math.PI / 2);
      pts.push(new Vector2(bx + Math.cos(a) * r, by + Math.sin(a) * r));
    }
  }
  // On along the top side, past where it began.
  const first = pts[0]!;
  const dir = pts[1]!.clone().sub(first).normalize();
  for (let i = 0; i <= 6; i++) pts.push(first.clone().addScaledVector(dir, (over * i) / 6));
  return pts;
}

/** A polyline as a flat ribbon, appended to `out`, with draw times running t0..t1 by length. */
function ribbon(
  out: { pos: number[]; t: number[]; color: number[] },
  pts: Vector2[],
  width: number,
  t0: number,
  t1: number,
  color: RGB,
  z: number,
) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
  const total = len[len.length - 1]!;
  const side = (i: number) => {
    const a = pts[Math.max(i - 1, 0)]!;
    const b = pts[Math.min(i + 1, pts.length - 1)]!;
    return new Vector2(a.y - b.y, b.x - a.x).normalize().multiplyScalar(width / 2);
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const [p, q] = [pts[i]!, pts[i + 1]!];
    const [sp, sq] = [side(i), side(i + 1)];
    const [tp, tq] = [t0 + (t1 - t0) * (len[i]! / total), t0 + (t1 - t0) * (len[i + 1]! / total)];
    const quad = [
      [p.x + sp.x, p.y + sp.y, tp],
      [p.x - sp.x, p.y - sp.y, tp],
      [q.x - sq.x, q.y - sq.y, tq],
      [p.x + sp.x, p.y + sp.y, tp],
      [q.x - sq.x, q.y - sq.y, tq],
      [q.x + sq.x, q.y + sq.y, tq],
    ];
    for (const [x, y, t] of quad) {
      out.pos.push(x!, y!, z);
      out.t.push(t!);
      out.color.push(...color);
    }
  }
}

export function Daumini({ world }: { world: World }) {
  const group = useRef<Group>(null);
  const board = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const { w, h, center, read } = world.daumini;
  // World units to a CSS px, seen from where the page is read.
  const px = (2 * TAN * (read.z - center.z)) / size.height;

  const res = useMemo(() => {
    const boardMat = boardMaterial();
    const inkMat = inkMaterial();

    // The frame: a firm stroke, then a second, finer and lighter, a little off it.
    const rand = seeded(1971);
    const fw = w + 2 * FRAME.margin * px;
    const fh = h + 2 * FRAME.margin * px;
    const r = FRAME.radius * px;
    const out = { pos: [] as number[], t: [] as number[], color: [] as number[] };
    ribbon(out, penLoop(fw, fh, r, 2.2 * px, 12 * px, rand), FRAME.ink * px, 0, 0.8, SKETCH.ink, 1);
    const second = penLoop(fw + 1.5 * px, fh - 1.5 * px, r, 3 * px, 18 * px, rand);
    ribbon(out, second, FRAME.ink2 * px, 0.8, 1, mix(SKETCH.paper, SKETCH.ink, 0.7), 1.2);
    const inkGeo = new BufferGeometry();
    inkGeo.setAttribute('position', new Float32BufferAttribute(out.pos, 3));
    inkGeo.setAttribute('aT', new Float32BufferAttribute(out.t, 1));
    inkGeo.setAttribute('aColor', new Float32BufferAttribute(out.color, 3));

    return { boardMat, inkMat, inkGeo, boardGeo: new PlaneGeometry(60000, 60000) };
  }, [w, h, px, world.star.z, read]);
  useEffect(
    () => () => {
      [res.inkGeo, res.boardGeo].forEach((g) => g.dispose());
      [res.boardMat, res.inkMat].forEach((m) => m.dispose());
    },
    [res],
  );

  const tmp = useMemo(
    () => ({
      corners: Array.from({ length: 4 }, () => new Vector3()),
    }),
    [],
  );

  // How far the page has come in, 0..1: in time, not scroll, so it is never left half in.
  const coming = useRef(0);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || !board.current) return;
    const p = frame.progress;
    // Seen through qiqi.help's page on the way in; fading back into the page
    // color as the camera turns back for the name.
    const sketch = 1 - smooth(span(p, [T.end[0], T.end[0] + 0.03]));
    g.visible = p > T.pass[0] && sketch > 0;
    const live = frame.dom.live.daumini;
    coming.current = Math.min(1, Math.max(0, coming.current + ((p > T.fill[0] ? 1 : -1) * Math.min(dt, 0.1)) / COME_IN));
    const reveal = smooth(coming.current);
    const u = res.boardMat.uniforms;
    if (!g.visible) {
      if (live) show(live, 0);
      u.uReveal!.value = 0;
      return;
    }

    for (const m of [res.boardMat, res.inkMat]) {
      m.uniforms.uSketch!.value = sketch;
      gl.getDrawingBufferSize(m.uniforms.uRes!.value);
    }
    board.current.position.copy(center);
    u.uStep!.value = DOT_STEP * px;
    u.uDotR!.value = DOT_R * px;
    u.uHalf!.value.set(w / 2, h / 2);
    res.inkMat.uniforms.uDraw!.value = span(p, T.draw);

    // daumini's page, pinned under the frame, the board over it thinning away.
    u.uReveal!.value = 0;
    if (!live) return;
    if (reveal <= 0) return show(live, 0);
    tmp.corners[0]!.set(center.x - w / 2, center.y + h / 2, center.z);
    tmp.corners[1]!.set(center.x + w / 2, center.y + h / 2, center.z);
    tmp.corners[2]!.set(center.x + w / 2, center.y - h / 2, center.z);
    tmp.corners[3]!.set(center.x - w / 2, center.y - h / 2, center.z);
    camera.updateMatrixWorld();
    const pinnedOk = pin(live, tmp.corners, camera, size.width, size.height) > 0;
    show(live, pinnedOk ? sketch : 0);
    u.uReveal!.value = pinnedOk ? reveal : 0;
  });

  return (
    <group ref={group}>
      <mesh ref={board} geometry={res.boardGeo} material={res.boardMat} />
      <mesh geometry={res.inkGeo} material={res.inkMat} position={center} frustumCulled={false} />
    </group>
  );
}
