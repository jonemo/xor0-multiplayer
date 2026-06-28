/**
 * Keyboard controls for the card table, shared by the solo and multiplayer
 * screens so the two stay in sync:
 *   1-9      toggle the card at that table position
 *   ←/→      move the keyboard hover to the adjacent card (starts leftmost)
 *   space    toggle the currently hovered card
 *   enter    submit the XORO! claim
 *
 * Returns the hovered index (for the elevated-card highlight) and a `clearHover`
 * to wire to mouse hover, since a pointer hover should drop the keyboard one.
 */
import { useEffect, useRef, useState } from 'react';
import type { CardValue } from '../lib/xor';

export interface TableKeyboardOptions {
  table: readonly CardValue[];
  /** Whether card-affecting keys (numbers, arrows, space) are active. */
  enabled: boolean;
  toggle: (v: CardValue) => void;
  /** Whether Enter can submit a claim right now. */
  canClaim: boolean;
  onClaim: () => void;
}

export interface TableKeyboard {
  hoverIndex: number | null;
  clearHover: () => void;
}

export function useTableKeyboard({
  table,
  enabled,
  toggle,
  canClaim,
  onClaim,
}: TableKeyboardOptions): TableKeyboard {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Reset the hover whenever the table contents change (e.g. after a claim), as
  // positions no longer refer to the same cards. Keyed on contents, not array
  // identity, so realtime updates that leave the table unchanged don't reset it.
  const tableKey = table.join(',');
  useEffect(() => {
    setHoverIndex(null);
  }, [tableKey]);

  // Keep the latest values reachable from the once-bound listener without
  // re-subscribing on every render.
  const kb = useRef({ table, enabled, toggle, canClaim, onClaim, hoverIndex });
  kb.current = { table, enabled, toggle, canClaim, onClaim, hoverIndex };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { table, enabled, toggle, canClaim, onClaim, hoverIndex } = kb.current;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (canClaim) onClaim();
        return;
      }

      if (!enabled) return;

      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        if (idx < table.length) {
          toggle(table[idx]);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (table.length === 0) return;
        setHoverIndex((cur) => {
          if (cur === null) return 0;
          const next = e.key === 'ArrowLeft' ? cur - 1 : cur + 1;
          return Math.max(0, Math.min(table.length - 1, next));
        });
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (hoverIndex !== null && hoverIndex < table.length) toggle(table[hoverIndex]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { hoverIndex, clearHover: () => setHoverIndex(null) };
}
