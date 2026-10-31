import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  InstancedBufferAttribute,
  LineSegments,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  Group,
  InstancedMesh,
  RingGeometry,
  type Mesh,
} from 'three';
import { nations } from '../data/site';
import { frame } from '../lib/frame-store';
import { C, QIQI, WASH, mix, type RGB } from '../lib/palette';
import { seeded } from '../lib/random';
import { askQiqi, qiqiReady, type QiqiStars } from '../lib/qiqi';
import { T, clamp01, easeInOut, easeOut, lerp, smooth, span } from '../lib/timeline';
import { LIVE_W, pin, show } from './live';
import { flatMaterial, instanceMaterial, plateMaterial } from './materials';
import { PLATE_SIZE, type World } from './world';

// qiqi.help's star map, drawn on the last plate: qiqi.help's own map, as the
// live site (loading out of sight) says where its stars, lines and names are,
// ink on warm paper as it draws it; then the whole map moves as one into its
// frame on the live page, which comes in round it and takes over. When the site
// has not said in time, a map of our own, one dot per character grouped by
// nation, gathers into its page instead.

// Cluster centers as fractions of the map, landscape and portrait.
// The bottom left stays clear for the title.
const WIDE: [number, number][] = [
  [-0.38, 0.32],
  [-0.14, 0.36],
  [0.1, 0.3],
  [0.34, 0.33],
  [0.04, -0.02],
  [0.42, 0.02],
  [-0.42, -0.06],
  [0.24, -0.3],
  [-0.08, -0.36],
];
/** The nation names' size, as in global.css. */
const LABEL_PX = 15;

const TALL: [number, number][] = [
  [-0.28, 0.4],
  [0.2, 0.42],
  [-0.3, 0.22],
  [0.24, 0.24],
  [0.0, 0.32],
  [-0.22, 0.07],
  [0.36, 0.1],
  [0.08, 0.13],
  [-0.38, 0.0],
];

interface Dot {
  pos: Vector3;
  grid: Vector3;
  r: number;
  delay: number;
  cluster: number;
  /** Its place in the nation's list. */
  slot: number;
}

function layout(world: World) {
  const rand = seeded(12569);
  const { w, h, shot } = world.star;
  const centers = (world.portrait ? TALL : WIDE).map(([x, y]) => new Vector3(x * w, y * h, 0));
  const dots: Dot[] = [];
  const lines: number[] = [];
  const total = nations.reduce((n, [, c]) => n + c, 0);
  const cols = Math.ceil(Math.sqrt((total * shot.w) / shot.h));
  const rows = Math.ceil(total / cols);

  nations.forEach(([, count], ci) => {
    const c = centers[ci]!;
    const radius = 26 + Math.sqrt(count) * 21;
    const mine: Vector3[] = [];
    for (let n = 0, tries = 0; n < count && tries < 4000; tries++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * radius;
      const p = new Vector3(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.8, 2);
      if (mine.some((q) => q.distanceTo(p) < 17)) continue;
      mine.push(p);
      n++;
    }
    // Constellation lines: the shortest tree through the cluster.
    const inTree = [0];
    while (inTree.length < mine.length) {
      let best = [0, 0, Infinity];
      for (const a of inTree)
        for (let b = 0; b < mine.length; b++) {
          if (inTree.includes(b)) continue;
          const d = mine[a]!.distanceTo(mine[b]!);
          if (d < best[2]!) best = [a, b, d];
        }
      inTree.push(best[1]!);
      const pa = mine[best[0]!]!;
      const pb = mine[best[1]!]!;
      lines.push(pa.x, pa.y, 1, pb.x, pb.y, 1);
    }
    mine.forEach((p, j) => {
      const k = dots.length;
      const gx = shot.x - shot.w / 2 + ((k % cols) + 0.5) * (shot.w / cols);
      const gy = shot.y + shot.h / 2 - (Math.floor(k / cols) + 0.5) * (shot.h / rows);
      dots.push({
        pos: p,
        grid: new Vector3(gx, gy, 4),
        r: j === 0 ? 7.5 : 3 + rand() * 3.2,
        delay: ci * 0.07 + j * 0.012 + rand() * 0.05,
        cluster: ci,
        slot: j,
      });
    });
  });
  return { centers, dots, lines: new Float32Array(lines) };
}

/** qiqi.help's ink dots, in its window's px: a dot's radius; a five-star's inner dot, and its ring's two radii. */
const INK = { dot: 1.8, five: 1.66, ring: [3.1, 4.1] as const };

/**
 * qiqi.help's own map, as it said where everything is in its window, and the
 * two places the whole map takes, as a scale and an offset from its window's px
 * (y down) to star-plate coordinates: filling the view, and in its frame on the
 * live page. In between, it is one piece moving from one to the other.
 */
function sharedMap(world: World, q: QiqiStars) {
  const { w, h, shot } = world.star;
  const f = q.frame;
  const full = Math.min((w * 0.94) / f.w, (h * 0.94) / f.h);
  const page = shot.w / LIVE_W;
  const root = new Group();
  const ink = (n: number, c: RGB, geo: BufferGeometry) => {
    geo.setAttribute('aColor', new InstancedBufferAttribute(Float32Array.from({ length: n * 3 }, (_, k) => c[k % 3]!), 3));
    const m = new InstancedMesh(geo, instanceMaterial(), n);
    m.frustumCulled = false;
    root.add(m);
    return m;
  };
  const fives = q.stars.filter((st) => st.five);
  const dots = ink(q.stars.length, QIQI.ink, new CircleGeometry(1, 20));
  const rings = ink(fives.length, mix(QIQI.paper, QIQI.ink, 0.7), new RingGeometry(INK.ring[0] / INK.ring[1], 1, 40));
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(Float32Array.from(q.lines.flatMap(([a, b]) => [a, b].flatMap((k) => [q.stars[k]!.x, -q.stars[k]!.y, -0.5]))), 3));
  // Each nation comes out in turn, as on the map of our own.
  const order = q.nations.map((n) => n.id);
  const seen = new Map<string, number>();
  const stars = q.stars.map((st) => {
    const j = seen.get(st.g) ?? 0;
    seen.set(st.g, j + 1);
    return { ...st, delay: Math.max(0, order.indexOf(st.g)) * 0.07 + j * 0.012 };
  });
  return {
    root,
    dots,
    rings,
    lineGeo,
    stars,
    fives: stars.filter((st) => st.five),
    names: nations.map(([zh]) => q.nations.find((n) => n.zh === zh) ?? null),
    full: { s: full, x: -(f.x + f.w / 2) * full, y: (f.y + f.h / 2) * full },
    page: { s: page, x: shot.x - shot.w / 2, y: shot.y + shot.h / 2 },
    dispose() {
      for (const m of [dots, rings]) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
      }
      lineGeo.dispose();
    },
  };
}

export function StarMap({ world }: { world: World }) {
  const group = useRef<Group>(null);
  const plate = useRef<Mesh>(null);
  const dotsRef = useRef<InstancedMesh>(null);
  const shot = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const data = useMemo(() => layout(world), [world]);
  const res = useMemo(() => {
    const plateMat = plateMaterial();
    const dotGeo = new CircleGeometry(1, 28);
    const dotMat = instanceMaterial();
    const colors = new Float32Array(data.dots.length * 3);
    // Ink dots, as on qiqi.help's own map.
    data.dots.forEach((_, i) => colors.set(QIQI.ink, i * 3));
    dotGeo.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute('position', new BufferAttribute(data.lines, 3));
    const lineMat = new ShaderMaterial({
      transparent: true,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: new Vector3(...QIQI.line) } },
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uOpacity; uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, uOpacity); }',
    });
    const plateGeo = new PlaneGeometry(1, 1);
    const shotGeo = new PlaneGeometry(1, 1);
    // Under the live page until it loads, and the same shape as it.
    const shotMat = flatMaterial(QIQI.paper);
    const line = new LineSegments(lineGeo, lineMat);
    line.renderOrder = 1;
    return { plateGeo, plateMat, dotGeo, dotMat, lineGeo, lineMat, line, shotGeo, shotMat };
  }, [data]);
  useEffect(
    () => () => {
      for (const x of [res.plateGeo, res.plateMat, res.dotGeo, res.dotMat, res.lineGeo, res.lineMat, res.shotGeo, res.shotMat]) x.dispose();
    },
    [res],
  );

  const tmp = useMemo(
    () => ({ m: new Matrix4(), v: new Vector3(), a: new Vector3(), b: new Vector3(), corners: Array.from({ length: 4 }, () => new Vector3()) }),
    [],
  );
  // qiqi.help's own map, settled as the stars come out: undefined before, null to draw our own and gather it into a page.
  const shared = useRef<ReturnType<typeof sharedMap> | null | undefined>(undefined);
  const asked = useRef(0);
  const pageWas = useRef(0);
  // The live page only comes in once qiqi.help has settled, never half loaded.
  const ready = useRef(0);
  useEffect(() => () => shared.current?.dispose(), []);

  useFrame((_, dt) => {
    const p = frame.progress;
    const g = group.current;
    const dots = dotsRef.current;
    if (!g || !dots || !plate.current || !shot.current) return;
    const { star } = world;
    const end = easeInOut(span(p, T.end));
    const appear = span(p, T.stars);
    const gather = span(p, T.gather);
    const pass = span(p, T.pass);

    // Gone once the line-up starts (see Plates).
    g.visible = end <= 0;
    g.position.set(0, 0, star.z);
    plate.current.scale.set(PLATE_SIZE, PLATE_SIZE, 1);
    const pu = res.plateMat.uniforms;
    pu.uSize!.value.set(PLATE_SIZE, PLATE_SIZE);
    // From the page color to qiqi.help's paper, as its stars come out.
    const own = smooth(span(p, T.stars));
    pu.uWash!.value = WASH * (1 - own);
    pu.uCream!.value.set(...mix(C.cream, QIQI.paper, own));
    // Its frame is a window to the next scene, opened while the page is fully over it.
    const win = pageWas.current >= 1 || pass > 0 ? 1 : 0;
    pu.uHole!.value.set((star.shot.w / 2) * win, (star.shot.h / 2) * win);
    pu.uHoleOff!.value.set(star.shot.x, star.shot.y);
    pu.uRadius!.value = 6;

    // On the way, keep asking qiqi.help (loading out of sight) where its map's
    // stars are; as they come out, settle on drawing its map or our own.
    if (p < T.stars[0]) {
      if (shared.current) {
        g.remove(shared.current.root);
        shared.current.dispose();
      }
      shared.current = undefined;
      if (frame.time - asked.current > 1) {
        asked.current = frame.time;
        askQiqi();
      }
    } else if (shared.current === undefined && frame.qiqi) {
      shared.current = sharedMap(world, frame.qiqi);
      shared.current.root.add(new LineSegments(shared.current.lineGeo, res.lineMat));
      g.add(shared.current.root);
    } else if (shared.current === undefined) shared.current = null;
    const map = shared.current ?? null;

    const shown = appear > 0 ? 1 : 0;
    const comeOut = (delay: number) => easeOut(clamp01((appear * 1.5 - delay) / 0.3)) * shown;
    // qiqi.help's map moves into its frame on the page as one piece, and stays
    // until the page is fully over it.
    const t = easeInOut(clamp01(gather / 0.8));
    dots.visible = !map;
    res.line.visible = !map;
    if (map) {
      // Until the live page is fully over it; if it never came, it goes as the camera sets off.
      const stay = 1 - smooth(span(p, [T.pass[0], T.pass[0] + 0.025]));
      map.root.visible = pageWas.current < 1 && stay > 0;
      map.root.position.set(lerp(map.full.x, map.page.x, t), lerp(map.full.y, map.page.y, t), 6);
      map.root.scale.setScalar(lerp(map.full.s, map.page.s, t));
      map.stars.forEach((st, i) => {
        const r = (st.five ? INK.five : INK.dot) * comeOut(st.delay) * stay;
        map.dots.setMatrixAt(i, tmp.m.makeScale(r, r, 1).setPosition(st.x, -st.y, 0));
      });
      map.fives.forEach((st, i) => {
        const r = INK.ring[1] * comeOut(st.delay) * stay;
        map.rings.setMatrixAt(i, tmp.m.makeScale(r, r, 1).setPosition(st.x, -st.y, 0));
      });
      map.dots.instanceMatrix.needsUpdate = true;
      map.rings.instanceMatrix.needsUpdate = true;
    } else {
      data.dots.forEach((d, i) => {
        const gi = easeInOut(clamp01((gather * 1.4 - d.delay * 0.5) / 0.7));
        tmp.v.lerpVectors(d.pos, d.grid, gi);
        const r = d.r * comeOut(d.delay) * (1 - smooth(clamp01((gather - 0.75) / 0.25)));
        tmp.m.makeScale(r, r, 1).setPosition(tmp.v);
        dots.setMatrixAt(i, tmp.m);
      });
      dots.instanceMatrix.needsUpdate = true;
    }

    res.lineMat.uniforms.uOpacity!.value =
      smooth(clamp01((appear - 0.55) / 0.45)) * (map ? 1 - smooth(span(p, [T.pass[0], T.pass[0] + 0.025])) : 1 - smooth(clamp01(gather * 4))) * shown;

    // qiqi.help's page, where the stars gather. The camera flies at it: once
    // it overfills the screen it gives way to the window opened behind it.
    shot.current.position.set(star.shot.x, star.shot.y, 5);
    shot.current.scale.set(star.shot.w, star.shot.h, 1);
    // With its map, the page comes in round it once the map is in its frame.
    const page = map ? smooth(clamp01((gather - 0.84) / 0.16)) : smooth(clamp01((gather - 0.55) / 0.35));
    const live = frame.dom.live.qiqi;
    // Shown only where it was just pinned.
    let through = 0;
    if (page > 0 && g.visible && live) {
      const { x, y, w, h } = star.shot;
      tmp.corners[0]!.set(x - w / 2, y + h / 2, 5);
      tmp.corners[1]!.set(x + w / 2, y + h / 2, 5);
      tmp.corners[2]!.set(x + w / 2, y - h / 2, 5);
      tmp.corners[3]!.set(x - w / 2, y - h / 2, 5);
      g.updateMatrixWorld();
      camera.updateMatrixWorld();
      for (const c of tmp.corners) g.localToWorld(c);
      const across = pin(live, tmp.corners, camera, size.width, size.height);
      through = across === 0 ? 0 : 1 - smooth(clamp01((across - 1.15) / 0.5));
    }
    // As the camera sets off, the page fades in its frame, and leaves the window.
    const leave = 1 - smooth(span(p, [T.pass[0], T.pass[0] + 0.025]));
    ready.current = qiqiReady() ? Math.min(1, ready.current + Math.min(dt, 0.1) / 0.5) : 0;
    const pageOn = page * through * leave * smooth(ready.current);
    pageWas.current = pageOn;
    res.shotMat.uniforms.uOpacity!.value = pageOn;
    shot.current.visible = pageOn > 0;
    // A window onto qiqi.help, to use with the pointer in it, only while it sits
    // in the view: once the camera flies in, the wheel carries on the flight.
    if (live) show(live, pageOn, p < T.pass[0]);

    // Nation names and the screenshot's link sit in the DOM, pinned to the map.
    // On qiqi.help's map, the names are its own, at its size, and go with it until its page is over them.
    const labelOn =
      smooth(clamp01((appear - 0.5) / 0.5)) * (map ? (1 - pageOn) * leave : 1 - smooth(clamp01(gather * 3))) * (1 - end);
    const toScreen = (v: Vector3) => {
      g.localToWorld(v).project(camera);
      return v.set(((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, 0);
    };
    data.centers.forEach((c, i) => {
      const el = frame.dom.labels[i];
      if (!el) return;
      let scale = 1;
      let on = labelOn;
      if (map) {
        const name = map.names[i];
        if (!name) on = 0;
        else {
          // Its place and size in its window, through the map's current scale and offset.
          const k = map.root.scale.x;
          tmp.v.set(map.root.position.x + name.x * k, map.root.position.y - name.y * k, 6);
          const there = toScreen(tmp.a.copy(tmp.v)).distanceTo(toScreen(tmp.b.copy(tmp.v).setX(tmp.v.x + name.size * k)));
          scale = there / LABEL_PX;
        }
      } else tmp.v.copy(c).setY(c.y - 26 - Math.sqrt(nations[i]![1]) * 21 * 0.8);
      toScreen(tmp.v);
      el.style.transform = `translate(${tmp.v.x}px, ${tmp.v.y}px) translate(-50%, 0) scale(${scale})`;
      el.style.opacity = String(on);
    });
  });

  return (
    <group ref={group}>
      <mesh ref={plate} geometry={res.plateGeo} material={res.plateMat} />
      <instancedMesh ref={dotsRef} args={[res.dotGeo, res.dotMat, data.dots.length]} frustumCulled={false} />
      <primitive object={res.line} />
      <mesh ref={shot} geometry={res.shotGeo} material={res.shotMat} renderOrder={2} />
    </group>
  );
}
