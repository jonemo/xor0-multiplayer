/** The face-up cards of a game, as a responsive selectable grid. */
import { Card } from './Card';
import type { CardValue } from '../lib/xor';
import './Table.css';

export interface TableProps {
  table: readonly CardValue[];
  selected?: readonly CardValue[];
  hinted?: readonly CardValue[];
  onToggle?: (v: CardValue) => void;
  showValues?: boolean;
}

export function Table({ table, selected = [], hinted = [], onToggle, showValues }: TableProps) {
  const hintSet = new Set(hinted);
  const dimming = hintSet.size > 0;
  return (
    <div className="xtable" data-count={table.length}>
      {table.map((v) => (
        <Card
          key={v}
          value={v}
          showValue={showValues}
          selected={selected.includes(v)}
          dimmed={dimming && !hintSet.has(v)}
          onClick={onToggle}
        />
      ))}
    </div>
  );
}
