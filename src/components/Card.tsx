/**
 * Procedural Xor0 card. Renders a card value as a low-poly mesh background with
 * a colored dot for each set bit. Each dot is labeled with its own bit value,
 * printed upright on the top half and rotated 180° on the bottom half (split by
 * a divider line) so it reads the same from either side of the table — matching
 * the physical card art (see src/lib/cards.ts).
 */
import { useId } from 'react';
import { dotsForCard, type DotSlot } from '../lib/cards';
import type { CardValue } from '../lib/xor';
import './Card.css';

const VB_W = 240;
const VB_H = 360;
const DOT_R = 34;

export interface CardProps {
  value: CardValue;
  selected?: boolean;
  /** Highlight as part of a set just claimed by someone (intermission). */
  claimed?: boolean;
  /** Visually de-emphasize (e.g. not part of a hovered group). */
  dimmed?: boolean;
  onClick?: (value: CardValue) => void;
  /** Show the card's total value in a corner (helper for new players). */
  showValue?: boolean;
  className?: string;
}

export function Card({ value, selected, claimed, dimmed, onClick, showValue, className }: CardProps) {
  const interactive = !!onClick;
  const dots = dotsForCard(value);

  return (
    <button
      type="button"
      className={[
        'xcard',
        selected ? 'xcard--selected' : '',
        claimed ? 'xcard--claimed' : '',
        dimmed ? 'xcard--dimmed' : '',
        interactive ? '' : 'xcard--static',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={!interactive}
      aria-pressed={interactive ? !!selected : undefined}
      aria-label={`Card ${value}`}
      onClick={onClick ? () => onClick(value) : undefined}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="xcard__svg" role="img">
        <MeshBackground />
        {dots.map((d) => (
          <Dot key={d.bit} slot={d} />
        ))}
        {showValue && (
          <text className="xcard__value" x={VB_W - 12} y={22} textAnchor="end">
            {value}
          </text>
        )}
      </svg>
    </button>
  );
}

function Dot({ slot }: { slot: DotSlot }) {
  const cx = slot.cx * VB_W;
  const cy = slot.cy * VB_H;
  return (
    <g>
      <circle cx={cx} cy={cy} r={DOT_R} fill={slot.hex} />
      {/* divider line across the dot center */}
      <line
        x1={cx - DOT_R * 0.78}
        y1={cy}
        x2={cx + DOT_R * 0.78}
        y2={cy}
        stroke="#ffffff"
        strokeWidth={1.5}
        opacity={0.85}
      />
      {/* bit value, upright on top half */}
      <text className="xcard__pip" x={cx} y={cy - DOT_R * 0.28} textAnchor="middle">
        {slot.bit}
      </text>
      {/* bit value, rotated 180° on bottom half */}
      <text
        className="xcard__pip"
        x={cx}
        y={cy + DOT_R * 0.28}
        textAnchor="middle"
        transform={`rotate(180 ${cx} ${cy + DOT_R * 0.05})`}
      >
        {slot.bit}
      </text>
    </g>
  );
}

/** Lightweight faint low-poly mesh, echoing the print art's identity. */
function MeshBackground() {
  const clip = useId();
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={VB_W} height={VB_H} rx={14} ry={14} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={VB_W} height={VB_H} rx={14} ry={14} fill="#ffffff" />
      <g clipPath={`url(#${clip})`} stroke="#d9d9d9" strokeWidth={1} fill="none" opacity={0.7}>
        {MESH_LINES.map((l, i) => (
          <polyline key={i} points={l} />
        ))}
      </g>
      <rect
        x={0.75}
        y={0.75}
        width={VB_W - 1.5}
        height={VB_H - 1.5}
        rx={14}
        ry={14}
        fill="none"
        stroke="#cfcfcf"
        strokeWidth={1.5}
      />
    </>
  );
}

/** A small static set of mesh polylines (kept simple; the dots are the focus). */
const MESH_LINES: string[] = [
  '0,70 60,40 130,90 200,30 240,80',
  '0,160 50,120 120,180 190,130 240,170',
  '0,250 70,210 140,270 200,230 240,260',
  '0,330 60,300 120,345 190,310 240,335',
  '40,0 70,90 30,170 80,250 50,360',
  '120,0 150,80 110,160 160,250 130,360',
  '200,0 230,90 190,170 235,250 205,360',
];
