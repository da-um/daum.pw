import { Canvas, useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import { Suspense, useEffect, useMemo } from 'react';
import { frame } from '../lib/frame-store';
import { Daumini } from './Daumini';
import { Fragments } from './Fragments';
import { Plates } from './Plates';
import { Rig } from './Rig';
import { StarMap } from './StarMap';
import { Wordmark } from './Wordmark';
import { FOV, makeWorld } from './world';

interface Props {
  dpr: number;
  onReady: () => void;
}

export default function Stage({ dpr, onReady }: Props) {
  return (
    <div className="stage" aria-hidden="true">
      <Canvas
        flat
        linear
        frameloop="never"
        dpr={dpr}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: FOV, near: 5, far: 60000, position: [0, 0, 2000] }}
      >
        <Driver />
        <Suspense fallback={null}>
          <Scene onReady={onReady} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Scene({ onReady }: { onReady: () => void }) {
  const size = useThree((s) => s.size);
  const world = useMemo(() => makeWorld(size.width / size.height), [size.width, size.height]);
  useEffect(() => {
    frame.start ||= performance.now();
    onReady();
  }, [onReady]);
  return (
    <>
      <Rig world={world} />
      <Wordmark />
      <Plates world={world} />
      <Fragments world={world} />
      <StarMap world={world} />
      <Daumini world={world} />
    </>
  );
}

/** Renders from gsap.ticker, the page's only frame loop. */
function Driver() {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      frame.time = frame.start ? (now - frame.start) / 1000 : 0;
      // Seconds, so useFrame's delta is in seconds too.
      advance(now / 1000);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [advance]);
  return null;
}
