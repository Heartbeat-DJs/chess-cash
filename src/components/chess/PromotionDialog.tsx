/* ===================================================================
   ChessCash — Promotion Dialog
   =================================================================== */

'use client';

import React from 'react';
import ChessPiece from './Piece';
import styles from './PromotionDialog.module.css';

interface PromotionDialogProps {
  color: 'w' | 'b';
  pieceSet?: string;
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

const CHOICES: { type: 'q' | 'r' | 'b' | 'n'; label: string }[] = [
  { type: 'q', label: 'Queen' },
  { type: 'r', label: 'Rook' },
  { type: 'b', label: 'Bishop' },
  { type: 'n', label: 'Knight' },
];

export default function PromotionDialog({ color, pieceSet = 'classic', onSelect, onCancel }: PromotionDialogProps) {
  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <span className={styles.title}>Promote to</span>
        <div className={styles.choices}>
          {CHOICES.map((c) => (
            <button
              key={c.type}
              className={styles.choice}
              onClick={() => onSelect(c.type)}
              aria-label={`Promote to ${c.label}`}
            >
              <ChessPiece type={c.type} color={color} set={pieceSet} size={56} />
              <span className={styles.choiceLabel}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
