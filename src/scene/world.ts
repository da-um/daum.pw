import { Vector3 } from 'three';
import { FOV, MARK_FIT, MARK_H, MARK_REST, MARK_W } from '../lib/mark';
import { T } from '../lib/timeline';
import { glyphs, type Glyph } from './glyphs';
import { LIVE_H, LIVE_W } from './live';
import { Rail, type Station } from './rail';

// World units: the wordmark is 1000 wide. x right, y up, -z is "deeper".

export { FOV };
export const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);

/** Camera distance at which a w x h box just fits the view. */
export const fitDistance = (w: number, h: number, aspect: number) => Math.max(w / (2 * TAN * aspect), h / (2 * TAN));

export { MARK_H, MARK_W };

/** Big enough to fill the view from any camera position on the way. */
export const PLATE_SIZE = 9000;
/** Font units -> world for the cut-out characters. */
export const GLYPH_SCALE = 0.95;
/**
 * The cut through each card in the tunnel: how deep, and how far it slants
 * down and right on the way (the opening wordmark's long shadow, in depth).
 * The camera threads the middle of the slant, clear of the walls at both ends.
 */
export const CUT = { depth: 180, slant: 110 };

/** How far a card runs beyond its character. */
const CARD_PAD = 180;
const marks = glyphs();
/** The name's tallest top and lowest bottom, in font units above its baseline. */
const TOP = Math.max(...marks.map((g) => g.h / 2 - g.base));
const BOTTOM = Math.min(...marks.map((g) => -g.h / 2 - g.base));

/**
 * Each plate is a card with one character cut out; the rest of the plate is
 * filler around it. A card is as wide as its character and as tall as the
 * tallest, each character on the same baseline. In the character's own
 * coordinates: x, y the bottom-left corner.
 */
export function cardOf(g: Glyph) {
  const w = g.w * GLYPH_SCALE + 2 * CARD_PAD;
  const h = (TOP - BOTTOM) * GLYPH_SCALE + 2 * CARD_PAD;
  return { x: -w / 2, y: (g.base + BOTTOM) * GLYPH_SCALE - CARD_PAD, w, h };
}
/** Distance over which the 135° wash runs from amber to orange on a plate. */
export const WASH_SPAN = 2600;

export interface Plate {
  z: number;
  /** Index into glyphs(), the character cut out of this plate. */
  glyph: number;
  x: number;
  y: number;
  /** Where the camera passes through: inside the character's stroke. */
  through: Vector3;
}

export interface World {
  aspect: number;
  portrait: boolean;
  heroDist: number;
  pageZ: number;
  tunnel: Plate[];
  star: {
    z: number;
    read: number;
    w: number;
    h: number;
    /** Where qiqi.help's live page sits, in star-plate coordinates. */
    shot: { x: number; y: number; w: number; h: number };
  };
  /** daumini's whiteboard: where its live page is drawn in, and where it is read from. */
  daumini: { center: Vector3; w: number; h: number; read: Vector3 };
  /**
   * The camera's way: in through the tunnel, easing in on the star map, into
   * qiqi.help's page and on to daumini's; then back out the way it came,
   * to face the name.
   */
  way: { on: Rail; back: Rail };
  /**
   * The ending: the cards stacked like the opening wordmark's layers, the
   * first in front, each one behind stepping right and down. Where each card's
   * character sits, how far apart in depth they are, and the camera on them.
   */
  stack: { slots: Vector3[]; depth: number; target: Vector3; camera: Vector3 };
}

/** The most of the view a character takes, seen from the one before it: width, height. */
const LETTER_FIT = { w: 0.9, h: 0.85 };
const MAX_SPACING = 2400;
/** In the stack: how much of a card's margin the next one leaves clear, its step down, and its step back. */
const STACK_GAP = 40;
const STACK_DROP = 70;
const STACK_DEPTH = 20;
/** From one row of the stack to the next: the characters, the margins between them, and a step to spare. */
const ROW = (TOP - BOTTOM) * GLYPH_SCALE + CARD_PAD + STACK_GAP + STACK_DROP;
/** The live pages on wide screens: most of the width they take, most of the height, and the gutter on their right. */
const PAGE_FIT = { w: 0.8, h: 0.82, gutter: 0.03 };
/** How far the camera eases in while daumini is read. */
const DRIFT = 300;
/** The camera reaches the star map this much further out than it reads it from, and eases in. */
const ARRIVE = 1.2;
const PAGE_Z = -170;

export function makeWorld(aspect: number): World {
  const portrait = aspect < 1;
  const heroDist = fitDistance(MARK_W / (portrait ? MARK_FIT.tall : MARK_FIT.wide), MARK_H / MARK_FIT.height, aspect);

  // Far enough apart that, just through one character, the camera has the
  // next one whole in view (its cut slanting with it) for a good while before
  // it flies into it; on tall screens, as near to that as the far plane allows.
  const spacing = Math.min(
    MAX_SPACING,
    fitDistance(
      (Math.max(...marks.map((g) => g.w)) * GLYPH_SCALE + CUT.slant * MARK_REST.x) / LETTER_FIT.w,
      (Math.max(...marks.map((g) => g.h)) * GLYPH_SCALE - CUT.slant * MARK_REST.y) / LETTER_FIT.h,
      aspect,
    ),
  );

  // Plates sit so that each character's thickest stroke lands on a gentle
  // spiral; the camera rides the spiral and threads every character, through
  // the middle of its slanting cut.
  const sway = portrait ? 30 : 70;
  const half = CUT.slant / 2;
  const tunnel: Plate[] = glyphs().map((g, i) => {
    const z = PAGE_Z - (i + 1) * spacing;
    const px = Math.cos(i * 0.9) * sway;
    const py = Math.sin(i * 0.9) * sway * 0.6;
    return {
      z,
      glyph: i,
      x: px - g.pole.x * GLYPH_SCALE - MARK_REST.x * half,
      y: py - g.pole.y * GLYPH_SCALE - MARK_REST.y * half,
      through: new Vector3(px, py, z),
    };
  });

  const starW = portrait ? 900 : 1700;
  const starH = portrait ? 1500 : 940;
  const read = fitDistance(starW, starH, aspect);
  // The live pages get most of the view, as they are, at their own layout: on
  // wide screens a share of the width that leaves a column on the left for the
  // title (and to scroll the page by), and some of the height clear.
  const viewW = 2 * TAN * read * aspect;
  const pageW = viewW * Math.min(PAGE_FIT.w, (PAGE_FIT.h * LIVE_W) / LIVE_H / aspect);
  const shot = portrait
    ? { x: 0, y: -330, w: 780, h: 488 }
    : { x: viewW / 2 - viewW * PAGE_FIT.gutter - pageW / 2, y: 0, w: pageW, h: (pageW * LIVE_H) / LIVE_W };
  const last = tunnel[tunnel.length - 1]!;
  const starZ = last.z - 300 - read * ARRIVE;

  // daumini's whiteboard lies behind qiqi.help's page: flying through the page
  // shows it. Read from straight ahead, its page is framed as qiqi.help's is,
  // the same size; on tall screens, above the title.
  const sketchDist = portrait ? shot.w / 0.86 / (2 * TAN * aspect) : read;
  const readPos = new Vector3(shot.x, shot.y, starZ - 400);
  const sketchCenter = portrait
    ? new Vector3(readPos.x, readPos.y + 2 * TAN * sketchDist * 0.14, readPos.z - sketchDist)
    : new Vector3(readPos.x + shot.x, readPos.y + shot.y, readPos.z - sketchDist);

  // The stack: one row on wide screens, daum over 12569 on tall ones. A card
  // covers only the margin of the next, so every character keeps clear of the
  // cards in front of it and has only the page behind it.
  const rows = portrait ? [marks.slice(0, 4), marks.slice(4)] : [marks];
  const cards = marks.map(cardOf);
  const slots: Vector3[] = [];
  let first = 0;
  rows.forEach((row, r) => {
    // The left edge of the card.
    let edge = 0;
    row.forEach((g, j) => {
      const i = first + j;
      if (j) edge += cards[i - 1]!.w - (CARD_PAD - STACK_GAP);
      // On one baseline, each card a step lower than the one in front.
      const y = -r * ROW - j * STACK_DROP - g.base * GLYPH_SCALE;
      slots.push(new Vector3(edge - cards[i]!.x, y, -i * STACK_DEPTH));
    });
    first += row.length;
  });
  // Centered on the cards' bounds.
  const left = Math.min(...slots.map((s, i) => s.x + cards[i]!.x));
  const right = Math.max(...slots.map((s, i) => s.x + cards[i]!.x + cards[i]!.w));
  const bottom = Math.min(...slots.map((s, i) => s.y + cards[i]!.y));
  const top = Math.max(...slots.map((s, i) => s.y + cards[i]!.y + cards[i]!.h));
  slots.forEach((s) => s.add(new Vector3(-(left + right) / 2, -(bottom + top) / 2, 0)));
  // In the upper part of the view, clear of the contacts below.
  const lineDist = fitDistance((right - left) / (portrait ? 0.86 : 0.84), (top - bottom) / 0.5, aspect);
  const lift = 2 * TAN * lineDist * (portrait ? 0.16 : 0.12);
  const target = new Vector3(0, -lift, 0);
  const camera = new Vector3(0, -lift, lineDist);

  // In the tunnel the camera looks two plates on, mostly straight down it.
  const starCenter = new Vector3(0, 0, starZ);
  const ahead = (k: number) => {
    const t = tunnel[k]?.through;
    return t ? new Vector3(t.x * 0.4, t.y * 0.4, t.z) : starCenter;
  };
  const sketchAhead = new Vector3(readPos.x, readPos.y, sketchCenter.z);
  const entry: Station = { pos: new Vector3(0, 0, PAGE_Z + 300), look: ahead(1) };
  const plates: Station[] = tunnel.map((t, i) => ({ pos: t.through, look: ahead(i + 2) }));
  const arrive: Station = { pos: new Vector3(0, 0, starZ + read * ARRIVE), look: starCenter };
  const reading: Station = { pos: new Vector3(0, 0, starZ + read), look: starCenter };
  const sketch: Station = { pos: readPos.clone(), look: sketchAhead };
  const on = new Rail(
    [
      { pos: new Vector3(0, 0, heroDist), look: new Vector3(0, 0, 0) },
      entry,
      ...plates,
      arrive,
      reading,
      // Turning to qiqi.help's page and daumini's behind it, through the page, and on.
      { pos: new Vector3(shot.x * 0.85, shot.y * 0.85, starZ + read * 0.35), look: sketchAhead },
      { pos: new Vector3(shot.x, shot.y, starZ - 40), look: sketchAhead },
      { pos: readPos.clone().setZ(readPos.z + DRIFT), look: sketchAhead },
      sketch,
    ],
    [
      [T.dive[0], 0],
      [T.dive[1], tunnel.length + 2],
      [T.ease[1], tunnel.length + 3],
      [T.pass[1], tunnel.length + 6],
      [T.back[0], tunnel.length + 7],
    ],
  );
  // Out the way it came (the star map and the page plates are gone by now, see T.end),
  // looking straight down the tunnel: unhurried through the plates, quicker either side.
  // Then away from them, each step a multiple further out in the same time, so they
  // shrink at an even pace, settling as it turns to face the name.
  const deep = { look: starCenter };
  const front = tunnel[0]!.z;
  const away = [0.3, 0.56, 0.78, 0.93].map((f) => {
    const dist = (entry.pos.z - front) * ((camera.z - front) / (entry.pos.z - front)) ** f;
    return { pos: new Vector3(0, camera.y * f, front + dist), look: starCenter.clone().lerp(target, f) };
  });
  const back = new Rail(
    [
      sketch,
      { ...reading, ...deep },
      { ...arrive, ...deep },
      ...[...plates].reverse().map((s) => ({ ...s, ...deep })),
      { ...entry, ...deep },
      ...away,
      { pos: camera, look: target },
    ],
    [
      [T.back[0], 0],
      [T.out[0], 2],
      ...[0, 1, 2, 3, 4, 5].map((k) => [T.out[1] + ((T.back[1] - T.out[1]) * k) / 5, tunnel.length + 3 + k] as const),
    ],
  );

  return {
    aspect,
    portrait,
    heroDist,
    pageZ: PAGE_Z,
    tunnel,
    star: { z: starZ, read, w: starW, h: starH, shot },
    daumini: { center: sketchCenter, w: shot.w, h: shot.h, read: readPos },
    way: { on, back },
    stack: { slots, depth: STACK_DEPTH, target, camera },
  };
}
