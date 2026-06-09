/* ===================================================================
   ChessCash — Chess Board Component
   Pointer-event driven (mouse + touch), animated piece movement,
   right-click highlights & arrows, themed with premium textures.
   =================================================================== */

'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import ChessPiece from './Piece';
import type { Square } from '@/types';
import { getBoardTheme } from '@/types';
import styles from './Board.module.css';

interface BoardPiece {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
}

interface BoardProps {
  fen: string;
  selectedSquare?: Square | null;
  legalMoves?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  isCheck?: boolean;
  turn?: 'w' | 'b';
  orientation?: 'white' | 'black';
  /** Which color the user may pick up. 'none' disables input. */
  interactiveColor?: 'w' | 'b' | 'both' | 'none';
  pieceSet?: string;
  boardTheme?: string;
  showCoordinates?: boolean;
  showLegalMoves?: boolean;
  animationsEnabled?: boolean;
  /** Squares to pulse with a hint ring (e.g. engine hint). */
  hintMove?: { from: Square; to: Square } | null;
  onSquareClick?: (square: Square) => void;
  onDragStart?: (square: Square) => void;
  onDragDrop?: (from: Square, to: Square) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function parseFEN(fen: string): (BoardPiece | null)[][] {
  const rows: (BoardPiece | null)[][] = [];
  for (const rank of fen.split(' ')[0].split('/')) {
    const row: (BoardPiece | null)[] = [];
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch, 10); i++) row.push(null);
      } else {
        row.push({
          type: ch.toLowerCase() as BoardPiece['type'],
          color: ch === ch.toUpperCase() ? 'w' : 'b',
        });
      }
    }
    rows.push(row);
  }
  return rows;
}

/** row 0 = rank 8, col 0 = file a (board coordinates, unflipped). */
function squareName(row: number, col: number): Square {
  return `${FILES[col]}${8 - row}` as Square;
}

function squareRC(square: Square): { row: number; col: number } {
  return { row: 8 - parseInt(square[1], 10), col: square.charCodeAt(0) - 97 };
}

function findKing(board: (BoardPiece | null)[][], color: string): Square | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) return squareName(r, c);
    }
  }
  return null;
}

interface AnimMove {
  piece: BoardPiece;
  from: { row: number; col: number };
  to: { row: number; col: number };
}

export default function ChessBoard({
  fen,
  selectedSquare = null,
  legalMoves = [],
  lastMove = null,
  isCheck = false,
  turn = 'w',
  orientation = 'white',
  interactiveColor = 'both',
  pieceSet = 'classic',
  boardTheme = 'mahogany',
  showCoordinates = true,
  showLegalMoves = true,
  animationsEnabled = true,
  hintMove = null,
  onSquareClick,
  onDragStart,
  onDragDrop,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const theme = getBoardTheme(boardTheme);
  const board = parseFEN(fen);
  const kingSquare = isCheck ? findKing(board, turn) : null;
  const isFlipped = orientation === 'black';

  // ── Drag state ────────────────────────────────────────────────
  const [drag, setDrag] = useState<{
    square: Square;
    piece: BoardPiece;
    x: number;
    y: number;
    moved: boolean;
    /** Board rect captured at drag start, for ghost positioning. */
    rectLeft: number;
    rectTop: number;
  } | null>(null);

  // ── Right-click annotations ───────────────────────────────────
  const [marks, setMarks] = useState<Square[]>([]);
  const [arrows, setArrows] = useState<{ from: Square; to: Square }[]>([]);
  const rightDragRef = useRef<Square | null>(null);

  // ── Move animation (overlay clones) ───────────────────────────
  const [anim, setAnim] = useState<{ moves: AnimMove[]; go: boolean } | null>(null);
  const prevFenRef = useRef(fen);
  // Timestamp of the last drop that should suppress animation; bounded
  // so a cancelled promotion can't swallow a later move's animation.
  const skipAnimRef = useRef(0);

  useEffect(() => {
    const prevFen = prevFenRef.current;
    prevFenRef.current = fen;
    if (prevFen === fen) return;
    const skip = Date.now() - skipAnimRef.current < 400;
    skipAnimRef.current = 0;
    if (!animationsEnabled || skip || !lastMove) {
      setAnim(null);
      return;
    }
    const prevBoard = parseFEN(prevFen);
    const newBoard = parseFEN(fen);
    const fromRC = squareRC(lastMove.from);
    const toRC = squareRC(lastMove.to);
    const movedPiece = prevBoard[fromRC.row][fromRC.col];
    const nowEmpty = newBoard[fromRC.row][fromRC.col] === null;
    if (!movedPiece || !nowEmpty) {
      setAnim(null);
      return;
    }

    const moves: AnimMove[] = [{ piece: movedPiece, from: fromRC, to: toRC }];

    // Castling — animate the rook too
    if (movedPiece.type === 'k' && Math.abs(toRC.col - fromRC.col) === 2) {
      const rank = fromRC.row;
      const isShort = toRC.col > fromRC.col;
      const rookFrom = { row: rank, col: isShort ? 7 : 0 };
      const rookTo = { row: rank, col: isShort ? 5 : 3 };
      const rook = prevBoard[rookFrom.row][rookFrom.col];
      if (rook && rook.type === 'r') moves.push({ piece: rook, from: rookFrom, to: rookTo });
    }

    setAnim({ moves, go: false });
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnim((a) => (a ? { ...a, go: true } : null)))
    );
    const timer = setTimeout(() => setAnim(null), 190);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [fen, lastMove, animationsEnabled]);

  // ── Pointer helpers ───────────────────────────────────────────
  const squareFromPointer = useCallback(
    (clientX: number, clientY: number): Square | null => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const size = rect.width / 8;
      let col = Math.floor((clientX - rect.left) / size);
      let row = Math.floor((clientY - rect.top) / size);
      if (col < 0 || col > 7 || row < 0 || row > 7) return null;
      if (isFlipped) {
        col = 7 - col;
        row = 7 - row;
      }
      return squareName(row, col);
    },
    [isFlipped]
  );

  const canPickUp = useCallback(
    (piece: BoardPiece | null): piece is BoardPiece => {
      if (!piece || interactiveColor === 'none') return false;
      if (interactiveColor === 'both') return piece.color === turn;
      return piece.color === interactiveColor && piece.color === turn;
    },
    [interactiveColor, turn]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const square = squareFromPointer(e.clientX, e.clientY);
      if (!square) return;

      // Right button → annotation mode
      if (e.button === 2) {
        rightDragRef.current = square;
        return;
      }
      if (e.button !== 0) return;

      // Left click clears annotations
      setMarks([]);
      setArrows([]);

      if (interactiveColor === 'none') return;

      const { row, col } = squareRC(square);
      const piece = board[row][col];

      if (canPickUp(piece)) {
        e.preventDefault();
        boardRef.current?.setPointerCapture(e.pointerId);
        onDragStart?.(square);
        const rect = boardRef.current?.getBoundingClientRect();
        setDrag({
          square,
          piece,
          x: e.clientX,
          y: e.clientY,
          moved: false,
          rectLeft: rect?.left ?? 0,
          rectTop: rect?.top ?? 0,
        });
      } else {
        onSquareClick?.(square);
      }
    },
    [squareFromPointer, interactiveColor, board, canPickUp, onDragStart, onSquareClick]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDrag((prev) =>
      prev
        ? {
            ...prev,
            x: e.clientX,
            y: e.clientY,
            moved:
              prev.moved ||
              Math.abs(e.clientX - prev.x) > 4 ||
              Math.abs(e.clientY - prev.y) > 4,
          }
        : null
    );
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Finish right-click annotation
      if (rightDragRef.current) {
        const from = rightDragRef.current;
        rightDragRef.current = null;
        const to = squareFromPointer(e.clientX, e.clientY);
        if (to && to !== from) {
          setArrows((prev) => {
            const exists = prev.findIndex((a) => a.from === from && a.to === to);
            if (exists >= 0) return prev.filter((_, i) => i !== exists);
            return [...prev, { from, to }];
          });
        } else if (to) {
          setMarks((prev) =>
            prev.includes(to) ? prev.filter((s) => s !== to) : [...prev, to]
          );
        }
        return;
      }

      if (!drag) return;
      setDrag(null);

      const target = squareFromPointer(e.clientX, e.clientY);
      if (!target) return;

      if (target !== drag.square && drag.moved) {
        // Only suppress the animation when the drop will actually move
        // (an illegal drop leaves the position unchanged, and a stale
        // flag would swallow the next real move's animation)
        skipAnimRef.current = legalMoves.includes(target) ? Date.now() : 0;
        onDragDrop?.(drag.square, target);
      } else if (target !== drag.square) {
        onSquareClick?.(target);
      }
      // pointerup on the origin square keeps the selection (click-to-move flow)
    },
    [drag, squareFromPointer, onDragDrop, onSquareClick, legalMoves]
  );

  const handlePointerCancel = useCallback(() => {
    setDrag(null);
    rightDragRef.current = null;
  }, []);

  // ── Geometry for overlays (percent-based) ─────────────────────
  const displayRC = useCallback(
    (square: Square) => {
      const { row, col } = squareRC(square);
      return {
        row: isFlipped ? 7 - row : row,
        col: isFlipped ? 7 - col : col,
      };
    },
    [isFlipped]
  );

  const animatingTargets = anim ? anim.moves.map((m) => squareName(m.to.row, m.to.col)) : [];

  return (
    <div
      className={`${styles.frame} ${styles[`texture_${theme.texture}`]}`}
      style={{ borderColor: theme.borderColor, background: theme.borderColor }}
    >
      <div
        ref={boardRef}
        className={styles.board}
        // Display-only boards must not swallow touch scrolling
        style={interactiveColor === 'none' ? { touchAction: 'auto' } : undefined}
        onPointerDown={interactiveColor === 'none' ? undefined : handlePointerDown}
        onPointerMove={interactiveColor === 'none' ? undefined : handlePointerMove}
        onPointerUp={interactiveColor === 'none' ? undefined : handlePointerUp}
        onPointerCancel={interactiveColor === 'none' ? undefined : handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {Array.from({ length: 8 }).map((_, dispRow) =>
          Array.from({ length: 8 }).map((__, dispCol) => {
            const row = isFlipped ? 7 - dispRow : dispRow;
            const col = isFlipped ? 7 - dispCol : dispCol;
            const square = squareName(row, col);
            const piece = board[row][col];
            const isLight = (row + col) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isLegal = showLegalMoves && legalMoves.includes(square);
            const isLastMove = lastMove !== null && (lastMove.from === square || lastMove.to === square);
            const isKingCheck = kingSquare === square;
            const isCapturable = isLegal && piece !== null;
            const isDragSource = drag?.square === square && drag.moved;
            const isAnimTarget = animatingTargets.includes(square);
            const isMarked = marks.includes(square);
            const isHint = hintMove !== null && (hintMove.from === square || hintMove.to === square);

            return (
              <div
                key={square}
                className={styles.square}
                style={{ backgroundColor: isLight ? theme.lightSquare : theme.darkSquare }}
                data-square={square}
              >
                {(isSelected || isLastMove) && (
                  <div
                    className={styles.highlightOverlay}
                    style={{ background: theme.highlight, opacity: isSelected ? 1 : 0.75 }}
                  />
                )}
                {isKingCheck && <div className={styles.checkOverlay} />}
                {isMarked && <div className={styles.markRing} />}
                {isHint && <div className={styles.hintRing} />}

                {showCoordinates && dispCol === 0 && (
                  <span
                    className={styles.coordRank}
                    style={{ color: isLight ? theme.darkSquare : theme.lightSquare }}
                  >
                    {8 - row}
                  </span>
                )}
                {showCoordinates && dispRow === 7 && (
                  <span
                    className={styles.coordFile}
                    style={{ color: isLight ? theme.darkSquare : theme.lightSquare }}
                  >
                    {FILES[col]}
                  </span>
                )}

                {piece && !isDragSource && !isAnimTarget && (
                  <div className={styles.piece}>
                    <ChessPiece type={piece.type} color={piece.color} set={pieceSet} />
                  </div>
                )}

                {isLegal && !isCapturable && <div className={styles.legalDot} />}
                {isCapturable && <div className={styles.captureRing} />}
              </div>
            );
          })
        )}

        {/* Animated move clones */}
        {anim &&
          anim.moves.map((m, i) => {
            const fromDisp = {
              row: isFlipped ? 7 - m.from.row : m.from.row,
              col: isFlipped ? 7 - m.from.col : m.from.col,
            };
            const toDisp = {
              row: isFlipped ? 7 - m.to.row : m.to.row,
              col: isFlipped ? 7 - m.to.col : m.to.col,
            };
            const dx = (toDisp.col - fromDisp.col) * 100;
            const dy = (toDisp.row - fromDisp.row) * 100;
            return (
              <div
                key={i}
                className={styles.animPiece}
                style={{
                  left: `${fromDisp.col * 12.5}%`,
                  top: `${fromDisp.row * 12.5}%`,
                  transform: anim.go ? `translate(${dx}%, ${dy}%)` : 'translate(0, 0)',
                }}
              >
                <ChessPiece type={m.piece.type} color={m.piece.color} set={pieceSet} />
              </div>
            );
          })}

        {/* Arrow annotations */}
        {arrows.length > 0 && (
          <svg className={styles.arrowLayer} viewBox="0 0 800 800">
            <defs>
              <marker
                id="cc-arrowhead"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="3.2"
                markerHeight="3.2"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(212, 160, 23, 0.85)" />
              </marker>
            </defs>
            {arrows.map((a, i) => {
              const f = displayRC(a.from);
              const t = displayRC(a.to);
              const x1 = f.col * 100 + 50;
              const y1 = f.row * 100 + 50;
              const x2 = t.col * 100 + 50;
              const y2 = t.row * 100 + 50;
              const len = Math.hypot(x2 - x1, y2 - y1) || 1;
              // shorten so the arrowhead lands inside the target square
              const shrink = 22;
              const ex = x2 - ((x2 - x1) / len) * shrink;
              const ey = y2 - ((y2 - y1) / len) * shrink;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={ex}
                  y2={ey}
                  stroke="rgba(212, 160, 23, 0.85)"
                  strokeWidth="18"
                  strokeLinecap="round"
                  markerEnd="url(#cc-arrowhead)"
                />
              );
            })}
          </svg>
        )}

        {/* Drag ghost */}
        {drag && drag.moved && (
          <div
            className={styles.dragGhost}
            style={{
              left: drag.x - drag.rectLeft,
              top: drag.y - drag.rectTop,
            }}
          >
            <ChessPiece type={drag.piece.type} color={drag.piece.color} set={pieceSet} />
          </div>
        )}
      </div>
    </div>
  );
}
