/**
 * Card rendering data: how a card value maps to dot positions and colors.
 *
 * Cards are rendered procedurally (not from 63 static SVGs). Each card is a
 * low-poly mesh background with a dot for each set bit. The bit/position/color
 * mapping below is taken from the source art in autosvg/ (Inkscape layers
 * dot1..dot32) and confirmed by the game owner.
 *
 *   bit  position       color
 *   1    bottom-left    orange  #aa4400
 *   2    bottom-right   blue    #353d5f
 *   4    middle-left    green   #433e0e
 *   8    middle-right   yellow  #c99600
 *   16   top-left       teal    #008080
 *   32   top-right      red     #800000
 */
import { ALL_BITS, BIT_COLOR, type CardValue, type Color } from './xor';

/** Dot slot column/row in the 2x3 grid, plus fractional center for rendering. */
export interface DotSlot {
  bit: number;
  color: Color;
  hex: string;
  col: 'left' | 'right';
  row: 'top' | 'middle' | 'bottom';
  /** Center as a fraction of card width/height (0..1), for SVG/CSS placement. */
  cx: number;
  cy: number;
}

/** Exact dot colors extracted from the print art (autosvg/*.svg). */
export const COLOR_HEX: Record<Color, string> = {
  orange: '#aa4400',
  blue: '#353d5f',
  green: '#433e0e',
  yellow: '#c99600',
  teal: '#008080',
  red: '#800000',
};

const COL_X = { left: 0.32, right: 0.68 } as const;
const ROW_Y = { top: 0.26, middle: 0.5, bottom: 0.74 } as const;

/** The fixed slot for each bit value. */
export const DOT_SLOTS: Record<number, DotSlot> = {
  1: makeSlot(1, 'left', 'bottom'),
  2: makeSlot(2, 'right', 'bottom'),
  4: makeSlot(4, 'left', 'middle'),
  8: makeSlot(8, 'right', 'middle'),
  16: makeSlot(16, 'left', 'top'),
  32: makeSlot(32, 'right', 'top'),
};

function makeSlot(bit: number, col: 'left' | 'right', row: 'top' | 'middle' | 'bottom'): DotSlot {
  const color = BIT_COLOR[bit];
  return { bit, color, hex: COLOR_HEX[color], col, row, cx: COL_X[col], cy: ROW_Y[row] };
}

/** The dots shown on a card, ordered low bit to high bit. */
export function dotsForCard(value: CardValue): DotSlot[] {
  return ALL_BITS.filter((b) => (value & b) !== 0).map((b) => DOT_SLOTS[b]);
}

/** Bridge-size aspect ratio of the physical cards (from the source SVG viewBox). */
export const CARD_ASPECT = 239.04 / 359.04; // width / height ≈ 0.666
