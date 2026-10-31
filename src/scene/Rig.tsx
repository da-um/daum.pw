import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { frame } from '../lib/frame-store';
import { T, easeInOut, lerp, smooth, span } from '../lib/timeline';
import { FOV, type World } from './world';

/** Moves the camera along the page's way (world.way), plus a little pointer parallax. */
export function Rig({ world }: { world: World }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const tmp = useMemo(
    () => ({
      pos: new Vector3(),
      look: new Vector3(),
      right: new Vector3(),
      up: new Vector3(),
      pointer: { x: 0, y: 0 },
    }),
    [],
  );

  useFrame((_, dt) => {
    const p = frame.progress;
    const { pos, look } = tmp;
    (p < T.back[0] ? world.way.on : world.way.back).at(p, pos, look);

    // Pointer parallax, strongest on the hero and the name.
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3);
    tmp.pointer.x += (frame.pointer.x - tmp.pointer.x) * k;
    tmp.pointer.y += (frame.pointer.y - tmp.pointer.y) * k;
    // None while a live page is read, so it faces the camera square and stays sharp (see live.ts pin).
    const reading = Math.max(
      smooth(span(p, [T.gather[1] - 0.04, T.gather[1]])) * (1 - smooth(span(p, [T.pass[0], T.pass[0] + 0.06]))),
      smooth(span(p, [T.fill[0], T.fill[0] + 0.03])) * (1 - smooth(span(p, [T.end[0], T.end[0] + 0.02]))),
    );
    const amount = (lerp(70, 30, span(p, T.open)) + easeInOut(span(p, T.back)) * 140) * (1 - reading);
    camera.position.copy(pos);
    camera.lookAt(look);
    tmp.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmp.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(tmp.right, tmp.pointer.x * amount).addScaledVector(tmp.up, tmp.pointer.y * amount * 0.6);
    camera.lookAt(look);
    if (camera.fov !== FOV) {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
