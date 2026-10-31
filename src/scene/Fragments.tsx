import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { DoubleSide, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { frame } from '../lib/frame-store';
import { shade } from '../lib/palette';
import { seeded } from '../lib/random';
import { T, smooth, span } from '../lib/timeline';
import { instanceMaterial } from './materials';
import type { World } from './world';

// Loose chips between the plates, in the colors of the layers around them.
// They rush past during the dive, and again on the way back out, and give the
// depth something to measure by.
/** One chip for every so much depth of the way. */
const EVERY = 20;

export function Fragments({ world }: { world: World }) {
  const items = useMemo(() => {
    const rand = seeded(2569);
    const z0 = world.pageZ - 60;
    const z1 = world.star.z + world.star.read * 0.5;
    return Array.from({ length: Math.round((z0 - z1) / EVERY) }, () => {
      const z = z0 + (z1 - z0) * rand();
      const a = rand() * Math.PI * 2;
      const d = 140 + rand() * 520;
      const depth = (z0 - z) / (z0 - z1);
      return {
        pos: new Vector3(Math.cos(a) * d, Math.sin(a) * d * 0.7, z),
        size: 5 + rand() ** 2 * 22,
        spin: (rand() - 0.5) * 1.6,
        rot: new Euler(rand() * 6, rand() * 6, rand() * 6),
        color: shade(1 - depth * 0.6 - rand() * 0.4, rand()),
      };
    });
  }, [world]);

  const mesh = useMemo(() => {
    const geo = new PlaneGeometry(1, 1);
    const colors = new Float32Array(items.length * 3);
    items.forEach((it, i) => colors.set(it.color, i * 3));
    geo.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
    const mat = instanceMaterial();
    mat.side = DoubleSide;
    const m = new InstancedMesh(geo, mat, items.length);
    m.frustumCulled = false;
    return m;
  }, [items]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as { dispose(): void }).dispose();
    },
    [mesh],
  );

  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), s: new Vector3() }), []);

  useFrame(() => {
    const p = frame.progress;
    // Grown as the wordmark parts, gone as qiqi.help's stars come out (its
    // section is drawn in its own colors); back out of the tunnel, they shrink away.
    const show =
      p < T.back[0] ? span(p, T.open) * (1 - smooth(span(p, T.stars))) : 1 - smooth(span(p, [T.out[1], T.out[1] + 0.02]));
    // Left behind the camera in between, at daumini's.
    mesh.visible = show > 0 && (p < T.pass[1] || p > T.back[0]);
    if (!mesh.visible) return;
    items.forEach((it, i) => {
      tmp.e.set(it.rot.x + frame.time * it.spin, it.rot.y + frame.time * it.spin * 0.7, it.rot.z);
      tmp.q.setFromEuler(tmp.e);
      tmp.s.setScalar(it.size * show);
      tmp.m.compose(it.pos, tmp.q, tmp.s);
      mesh.setMatrixAt(i, tmp.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
