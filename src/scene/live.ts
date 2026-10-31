import { Vector3, type Camera } from 'three';

/** The size the live pages are laid out at, in CSS px; the pin scales them down. */
export const LIVE_W = 1280;
export const LIVE_H = 800;

const v = new Vector3();
const xs = [0, 0, 0, 0];
const ys = [0, 0, 0, 0];

/**
 * Pins a LIVE_W x LIVE_H element onto a rectangle in the scene, given its
 * corners in world space: top left, top right, bottom right, bottom left.
 * The element gets the perspective transform that maps it onto the corners'
 * place on screen. Returns the share of the screen's width it spans, or 0
 * when a corner is behind the camera (the element is then left as it was).
 */
export function pin(el: HTMLElement, corners: Vector3[], camera: Camera, width: number, height: number) {
  for (let i = 0; i < 4; i++) {
    v.copy(corners[i]!).applyMatrix4(camera.matrixWorldInverse);
    if (v.z > -10) return 0;
    v.applyMatrix4(camera.projectionMatrix);
    xs[i] = ((v.x + 1) / 2) * width;
    ys[i] = ((1 - v.y) / 2) * height;
  }
  const [x0, x1, x2, x3] = xs as [number, number, number, number];
  const [y0, y1, y2, y3] = ys as [number, number, number, number];

  // The unit square onto the four points (Heckbert's square-to-quad).
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = (x1 - x0 + g * x1) / LIVE_W;
  const b = (x3 - x0 + h * x3) / LIVE_H;
  const d = (y1 - y0 + g * y1) / LIVE_W;
  const e = (y3 - y0 + h * y3) / LIVE_H;
  const gw = g / LIVE_W;
  const hh = h / LIVE_H;
  // Seen head on (no perspective to speak of), a plain 2D scale on whole
  // pixels: the browser then draws the page at the size it shows, sharp. A 3D
  // transform it draws once and stretches, blurred.
  const flat = Math.abs(x2 - (x1 + x3 - x0)) < 1 && Math.abs(y2 - (y1 + y3 - y0)) < 1;
  el.style.transform = flat
    ? `matrix(${(x1 - x0) / LIVE_W},${(y1 - y0) / LIVE_W},${(x3 - x0) / LIVE_H},${(y3 - y0) / LIVE_H},${Math.round(x0)},${Math.round(y0)})`
    : `matrix3d(${a},${d},0,${gw},${b},${e},0,${hh},0,0,1,0,${x0},${y0},0,1)`;
  return (Math.max(...xs) - Math.min(...xs)) / width;
}

/** Shows or hides a pinned page; it only takes the pointer once mostly in, and while `take`. */
export function show(el: HTMLElement, opacity: number, take = true) {
  el.style.opacity = String(opacity);
  el.style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
  el.style.pointerEvents = take && opacity > 0.6 ? 'auto' : 'none';
}
