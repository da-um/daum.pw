import qiqiShot from '../assets/work/qiqi.jpg';
import dauminiShot from '../assets/work/daumini.jpg';
import { BRAND_BOUNDS, BRAND_PATHS, BRAND_TEXT } from '../data/brand-glyph';
import { contacts, ids, mail, works } from '../data/site';
import { CopyId } from './CopyId';

const { x, y, w, h } = BRAND_BOUNDS;

/** The page without WebGL or with reduced motion: same content, no scene. */
export function Flat() {
  return (
    <main className="flat">
      <h1 className="flat-mark">
        <svg viewBox={`${x} 0 ${w} ${h}`} aria-hidden="true" focusable="false">
          <defs>
            {/* The wordmark's face from neu.css: amber and orange, each 55% with white, left to right. */}
            <linearGradient id="flat-face" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--amber) 55%, white)' }} />
              <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--orange) 55%, white)' }} />
            </linearGradient>
          </defs>
          <g fill="url(#flat-face)" transform={`translate(0 ${y + h}) scale(1 -1)`}>
            {BRAND_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </svg>
        <span className="sr">{BRAND_TEXT}</span>
      </h1>
      {[
        { ...works.qiqi, img: qiqiShot },
        { ...works.daumini, img: dauminiShot },
      ].map((wk) => (
        <a key={wk.url} className="flat-work" href={wk.url} target="_blank" rel="noreferrer">
          <img src={wk.img} alt="" width={1440} height={900} loading="lazy" />
          <span>{wk.name}</span>
        </a>
      ))}
      <footer className="flat-end">
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
        </div>
      </footer>
    </main>
  );
}
