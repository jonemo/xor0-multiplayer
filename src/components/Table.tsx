/** The face-up cards of a game, as a responsive selectable grid. */
import { Card } from './Card';
import type { CardValue } from '../lib/xor';
import './Table.css';

export interface TableProps {
  table: readonly CardValue[];
  selected?: readonly CardValue[];
  hinted?: readonly CardValue[];
  /** Cards highlighted as a just-claimed set during the intermission. */
  claimed?: readonly CardValue[];
  onToggle?: (v: CardValue) => void;
  /** When set, the corner badge shows the 1-based table position, not the value. */
  showValues?: boolean;
  /** Index of the card elevated via keyboard navigation (null = none). */
  hoveredIndex?: number | null;
  /** Fired when the pointer enters any card (used to clear keyboard hover). */
  onCardHover?: (v: CardValue) => void;
}

export function Table({
  table,
  selected = [],
  hinted = [],
  claimed = [],
  onToggle,
  showValues,
  hoveredIndex = null,
  onCardHover,
}: TableProps) {
  const hintSet = new Set(hinted);
  const dimming = hintSet.size > 0;
  return (
    <div className="xtable" data-count={table.length}>
      {table.map((v, i) => (
        <Card
          key={v}
          value={v}
          showValue={showValues}
          displayValue={showValues ? i + 1 : undefined}
          selected={selected.includes(v)}
          claimed={claimed.includes(v)}
          dimmed={dimming && !hintSet.has(v)}
          hovered={i === hoveredIndex}
          onClick={onToggle}
          onHover={onCardHover}
        />
      ))}
    </div>
  );
}
