import { useImperativeHandle, useRef, type Ref } from 'react';
import { BRAND_TEXT } from '../data/brand-glyph';
import { DAUMINI_BOUNDS, DAUMINI_DOT, DAUMINI_DOTS, DAUMINI_PATHS } from '../data/daumini-glyph';
import { contacts, ids, mail, nations, works } from '../data/site';
import { frame } from '../lib/frame-store';
import { clamp01, smooth } from '../lib/timeline';
import { CopyId } from './CopyId';

export interface OverlayHandle {
  update(p: number): void;
}

// [fade in from, fully in, start fading out, gone], as page progress.
const WINDOWS = {
  qiqi: [0.3, 0.34, 0.55, 0.58],
  daumini: [0.76, 0.79, 0.83, 0.855],
  end: [0.945, 0.975, 2, 2],
} as const;

// Where each live page is loaded: a little before it shows, and let go of
// once the page is well past it, so the sites only run while they are near.
// qiqi.help from the start: the page is only let in once it has settled (App.tsx),
// and its map is drawn here from what it says.
const LIVE = { qiqi: [0, 0.7], daumini: [0.56, 0.92] } as const;
const LET_GO = 0.05;
type Live = keyof typeof LIVE;

const visibility = (p: number, [a, b, c, d]: readonly number[]) =>
  smooth(clamp01((p - a!) / (b! - a!))) * (1 - smooth(clamp01((p - c!) / (d! - c!))));

const toTop = (e: React.MouseEvent) => {
  e.preventDefault();
  dispatchEvent(new Event('daum:top'));
};

/** Text, links and the live pages over the scene. Positions and fades are set every frame. */
export function Overlay({ ref }: { ref: Ref<OverlayHandle> }) {
  const parts = useRef<Record<keyof typeof WINDOWS, HTMLElement | null>>({ qiqi: null, daumini: null, end: null });
  const frames = useRef<Record<Live, HTMLIFrameElement | null>>({ qiqi: null, daumini: null });
  const bar = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    update(p) {
      for (const key of Object.keys(WINDOWS) as (keyof typeof WINDOWS)[]) {
        const el = parts.current[key];
        if (!el) continue;
        const v = visibility(p, WINDOWS[key]);
        el.style.opacity = String(v);
        el.style.setProperty('--in', String(v));
        el.style.visibility = v > 0.01 ? 'visible' : 'hidden';
        el.style.pointerEvents = v > 0.6 ? 'auto' : 'none';
      }
      for (const key of Object.keys(LIVE) as Live[]) {
        const f = frames.current[key];
        if (!f) continue;
        const [a, b] = LIVE[key];
        if (!f.dataset.on && p >= a && p < b) {
          f.dataset.on = '1';
          const w = works[key];
          f.src = 'embed' in w ? w.embed : w.url;
        } else if (f.dataset.on && (p < a - LET_GO || p > b + LET_GO)) {
          delete f.dataset.on;
          if (key === 'qiqi') Object.assign(frame, { qiqi: null, qiqiReady: false, qiqiLoaded: 0 });
          f.parentElement?.classList.remove('loaded');
          f.src = 'about:blank';
        }
      }
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      const moved = smooth(clamp01(p / 0.012));
      if (track.current) track.current.style.opacity = String(moved);
      if (cue.current) cue.current.style.opacity = String(1 - moved);
    },
  }));

  const keep = (key: keyof typeof WINDOWS) => (el: HTMLElement | null) => {
    parts.current[key] = el;
  };

  // A site, live. The scene pins it onto its place and fades it.
  const frameOf = (key: Live, use: boolean) => (
    <iframe
      ref={(el) => {
        frames.current[key] = el;
      }}
      title={works[key].name}
      tabIndex={use ? undefined : -1}
      sandbox={use ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox' : 'allow-scripts allow-same-origin'}
      onLoad={(e) => {
        if (!e.currentTarget.dataset.on) return;
        e.currentTarget.parentElement?.classList.add('loaded');
        if (key === 'qiqi') frame.qiqiLoaded = performance.now();
      }}
    />
  );
  const pinned = (key: Live) => (el: HTMLElement | null) => {
    frame.dom.live[key] = el;
  };

  return (
    <>
    {/* Under the scene: daumini's page, shown where the marker hatches it in (Daumini.tsx). */}
    <div className="under">
      <a className="live sketch" href={works.daumini.url} target="_blank" rel="noreferrer" aria-label={`打开 ${works.daumini.name}`} ref={pinned('daumini')}>
        {frameOf('daumini', false)}
      </a>
    </div>
    <div className="overlay">
      <h1 className="sr">{BRAND_TEXT}</h1>
      {/* On the first screen only a line running down, to say there is more below;
          once the page moves, the progress line stands in for the scrollbar. */}
      <div className="cue" aria-hidden="true" ref={cue}>
        <span />
      </div>
      <div className="progress" aria-hidden="true" ref={track}>
        <span ref={bar} />
      </div>

      <div className="labels" aria-hidden="true">
        {nations.map(([name], i) => (
          <span
            key={name}
            ref={(el) => {
              if (el) frame.dom.labels[i] = el;
            }}
          >
            {name}
          </span>
        ))}
      </div>

      {/* qiqi.help itself, to use right here. */}
      <div className="live use qiqi" ref={pinned('qiqi')}>
        {frameOf('qiqi', true)}
      </div>
      <section className="title qiqi" ref={keep('qiqi')}>
        <a href={works.qiqi.url} target="_blank" rel="noreferrer">
          {works.qiqi.name}
        </a>
      </section>

      {/* daumini's name as it writes it, in its hand, the red pen dotting the i's last. */}
      <section className="title daumini" ref={keep('daumini')}>
        <a href={works.daumini.url} target="_blank" rel="noreferrer" aria-label={works.daumini.name}>
          <svg viewBox={`${DAUMINI_BOUNDS.x} 0 ${DAUMINI_BOUNDS.w} ${DAUMINI_BOUNDS.h}`} aria-hidden="true" focusable="false">
            <g transform={`translate(0 ${DAUMINI_BOUNDS.y + DAUMINI_BOUNDS.h}) scale(1 -1)`}>
              {DAUMINI_PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
              {DAUMINI_DOTS.map((dot) => (
                <ellipse key={dot.x} className="pen-dot" cx={dot.x} cy={dot.y} rx={DAUMINI_DOT.rx} ry={DAUMINI_DOT.ry} />
              ))}
            </g>
          </svg>
        </a>
      </section>

      <section className="end" ref={keep('end')}>
        <a className="end-mail" href={`mailto:${mail}`}>
          {mail}
        </a>
        <div className="end-links">
          {ids.map((c) => (
            <CopyId key={c.label} {...c} />
          ))}
          {contacts.map((c) => (
            <a key={c.label} href={c.url} target="_blank" rel="noreferrer">
              {c.label}
            </a>
          ))}
          <a href="#" onClick={toTop}>
            回到开头
          </a>
        </div>
      </section>
    </div>
    </>
  );
}
