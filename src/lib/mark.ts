import { BRAND_BOUNDS } from '../data/brand-glyph';
import { shade } from './palette';

// The opening wordmark, as both the 3D scene and the loading screen draw it
// (boot/plugin.ts). They must match exactly: the loading screen hands over
// to the scene without a seam.

/** Width of the wordmark in world units. */
export const MARK_W = 1000;
export const MARK_H = (MARK_W * BRAND_BOUNDS.h) / BRAND_BOUNDS.w;

/** Cut-outs in the stack, the face first. */
export const MARK_LAYERS = 14;
/** World units between two layers of the long shadow. */
export const MARK_STEP = 2.8;
/** How far each layer sits behind the one in front of it, to keep them in order. */
export const MARK_SINK = 0.8;
/** Which way the shadow falls with the pointer at rest (x right, y up). */
export const MARK_REST = { x: 0.6, y: -0.8 };
/** The color of layer i of the long shadow, 1 right behind the face. */
export const markShade = (i: number) => shade((i - 1) / (MARK_LAYERS - 2));

/** How much of the screen the wordmark spans in the opening: width on wide and tall screens, at most this height. */
export const MARK_FIT = { wide: 0.78, tall: 0.9, height: 0.3 };

/** The camera's vertical field of view, in degrees. */
export const FOV = 30;

/**
 * The opening, played by the loading screen: the layers fly in from all round
 * (a golden angle apart), turning and from nearer the camera, and settle into
 * the stack, the deepest first and the face last. Seconds and world units.
 */
export const MARK_INTRO = { delay: 0.2, stagger: 0.06, flight: 0.8, reach: 1500, squash: 0.6, depth: 400, turn: 0.7, spread: 2.39996 };
