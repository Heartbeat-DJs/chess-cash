/* ===================================================================
   ChessCash — Settings Panel
   Slide-in drawer: piece sets, board themes, behavior toggles.
   =================================================================== */

'use client';

import React from 'react';
import { useSettings } from '@/context/SettingsContext';
import { PIECE_SETS } from '@/lib/piece-sets';
import { BOARD_THEMES } from '@/types';
import ChessPiece from '@/components/chess/Piece';
import { playSound } from '@/lib/sounds';
import styles from './SettingsPanel.module.css';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Show the eval-bar toggle (only meaningful vs computer). */
  showEvalOption?: boolean;
}

export default function SettingsPanel({ open, onClose, showEvalOption = false }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();

  if (!open) return null;

  const toggles: { key: keyof typeof settings; label: string; hint?: string }[] = [
    { key: 'showLegalMoves', label: 'Show legal moves' },
    { key: 'showCoordinates', label: 'Board coordinates' },
    { key: 'enableAnimations', label: 'Piece animations' },
    { key: 'showCapturedPieces', label: 'Captured pieces' },
    { key: 'autoQueen', label: 'Auto-queen', hint: 'Always promote to queen' },
    { key: 'confirmResign', label: 'Confirm resign' },
    ...(showEvalOption
      ? [{ key: 'showEvalBar' as const, label: 'Evaluation bar', hint: 'Live engine eval vs computer' }]
      : []),
  ];

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h3 className={styles.heading}>Customize</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">✕</button>
        </header>

        <div className={styles.scroll}>
          {/* Piece sets */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Piece Set</h4>
            <div className={styles.pieceSetGrid}>
              {PIECE_SETS.map((set) => (
                <button
                  key={set.id}
                  className={`${styles.pieceSetCard} ${settings.pieceSet === set.id ? styles.active : ''}`}
                  onClick={() => updateSettings({ pieceSet: set.id })}
                >
                  <div className={styles.pieceSetPreview}>
                    <ChessPiece type="k" color="w" set={set.id} size={34} shadow={false} />
                    <ChessPiece type="q" color="b" set={set.id} size={34} shadow={false} />
                    <ChessPiece type="n" color="w" set={set.id} size={34} shadow={false} />
                  </div>
                  <span className={styles.pieceSetName}>{set.name}</span>
                  <span className={styles.pieceSetDesc}>{set.description}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Board themes */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Board Theme</h4>
            <div className={styles.themeGrid}>
              {BOARD_THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`${styles.themeCard} ${settings.boardTheme === t.id ? styles.active : ''}`}
                  onClick={() => updateSettings({ boardTheme: t.id })}
                  title={t.name}
                >
                  <div className={styles.swatch} style={{ borderColor: t.borderColor }}>
                    <span style={{ background: t.lightSquare }} />
                    <span style={{ background: t.darkSquare }} />
                    <span style={{ background: t.darkSquare }} />
                    <span style={{ background: t.lightSquare }} />
                  </div>
                  <span className={styles.themeName}>
                    {t.name}
                    {t.premium && <span className={styles.premiumStar}> ✦</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Sound */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Sound</h4>
            <label className={styles.toggleRow}>
              <span>Game sounds</span>
              <input
                type="checkbox"
                checked={settings.enableSounds}
                onChange={(e) => {
                  updateSettings({ enableSounds: e.target.checked });
                  if (e.target.checked) setTimeout(() => playSound('move'), 50);
                }}
                className={styles.checkbox}
              />
            </label>
            {settings.enableSounds && (
              <label className={styles.sliderRow}>
                <span>Volume</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(settings.soundVolume * 100)}
                  onChange={(e) => updateSettings({ soundVolume: parseInt(e.target.value, 10) / 100 })}
                  onPointerUp={() => playSound('capture')}
                  className={styles.slider}
                />
              </label>
            )}
          </section>

          {/* Behavior */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Behavior</h4>
            {toggles.map((t) => (
              <label key={t.key} className={styles.toggleRow}>
                <span>
                  {t.label}
                  {t.hint && <small className={styles.hint}>{t.hint}</small>}
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(settings[t.key])}
                  onChange={(e) => updateSettings({ [t.key]: e.target.checked })}
                  className={styles.checkbox}
                />
              </label>
            ))}
          </section>

          <p className={styles.credits}>
            Piece artwork: Colin M.L. Burnett (CC BY-SA 3.0), Armando H. Marroquin (freeware).
          </p>
        </div>
      </aside>
    </div>
  );
}
