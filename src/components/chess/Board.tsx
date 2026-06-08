/* ===================================================================
   ChessCash — Chess Board Component
   Interactive, animated, beautiful
   =================================================================== */

'use client';

import React, { useRef, useState, useCallback } from 'react';
import ChessPiece from './Piece';
import type { Square, BoardThemeConfig } from '@/types';
import { BOARD_THEMES } from '@/types';
import styles from './Board.module.css';

interface BoardProps {
    fen: string;
    selectedSquare: Square | null;
    legalMoves: Square[];
    lastMove: { from: Square; to: Square } | null;
    isCheck: boolean;
    turn: 'w' | 'b';
    orientation?: 'white' | 'black';
    boardTheme?: string;
    showCoordinates?: boolean;
    onSquareClick: (square: Square) => void;
    onDragStart?: (square: Square) => void;
    onDragDrop?: (from: Square, to: Square) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

function parseFEN(fen: string): (null | { type: string; color: string })[][] {
    const board: (null | { type: string; color: string })[][] = [];
    const ranks = fen.split(' ')[0].split('/');

    for (const rank of ranks) {
        const row: (null | { type: string; color: string })[] = [];
        for (const char of rank) {
            if (char >= '1' && char <= '8') {
                for (let i = 0; i < parseInt(char); i++) row.push(null);
            } else {
                const color = char === char.toUpperCase() ? 'w' : 'b';
                const type = char.toLowerCase();
                row.push({ type, color });
            }
        }
        board.push(row);
    }
    return board;
}

function getSquareName(row: number, col: number): Square {
    return `${FILES[col]}${RANKS[row]}` as Square;
}

function findKingSquare(board: (null | { type: string; color: string })[][], color: string): Square | null {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type === 'k' && piece.color === color) {
                return getSquareName(r, c);
            }
        }
    }
    return null;
}

export default function ChessBoard({
    fen,
    selectedSquare,
    legalMoves,
    lastMove,
    isCheck,
    turn,
    orientation = 'white',
    boardTheme = 'mahogany',
    showCoordinates = true,
    onSquareClick,
    onDragStart,
    onDragDrop,
}: BoardProps) {
    const boardRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<{
        square: Square;
        piece: { type: string; color: string };
        x: number;
        y: number;
    } | null>(null);

    const theme = BOARD_THEMES.find((t) => t.id === boardTheme) || BOARD_THEMES[0];
    const board = parseFEN(fen);
    const kingSquare = isCheck ? findKingSquare(board, turn) : null;

    const isFlipped = orientation === 'black';
    const displayRanks = isFlipped ? [...RANKS].reverse() : RANKS;
    const displayFiles = isFlipped ? [...FILES].reverse() : FILES;

    const handleMouseDown = useCallback(
        (e: React.MouseEvent, square: Square, piece: { type: string; color: string } | null) => {
            if (!piece || !onDragStart) return;
            if (piece.color !== turn) return;

            e.preventDefault();
            onDragStart(square);
            setDragging({
                square,
                piece,
                x: e.clientX,
                y: e.clientY,
            });
        },
        [onDragStart, turn]
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!dragging) return;
            setDragging((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
        },
        [dragging]
    );

    const handleMouseUp = useCallback(
        (e: React.MouseEvent) => {
            if (!dragging || !boardRef.current || !onDragDrop) {
                setDragging(null);
                return;
            }

            const rect = boardRef.current.getBoundingClientRect();
            const squareSize = rect.width / 8;
            let col = Math.floor((e.clientX - rect.left) / squareSize);
            let row = Math.floor((e.clientY - rect.top) / squareSize);

            if (isFlipped) {
                col = 7 - col;
                row = 7 - row;
            }

            if (col >= 0 && col < 8 && row >= 0 && row < 8) {
                const targetSquare = getSquareName(row, col);
                if (targetSquare !== dragging.square) {
                    onDragDrop(dragging.square, targetSquare);
                }
            }

            setDragging(null);
        },
        [dragging, isFlipped, onDragDrop]
    );

    return (
        <div className={styles.boardWrapper}>
            {/* Border decoration */}
            <div
                className={styles.boardBorder}
                style={{ borderColor: theme.borderColor }}
            >
                {/* File labels (top) */}
                {showCoordinates && (
                    <div className={styles.coordsTop}>
                        {displayFiles.map((f) => (
                            <span key={f} className={styles.coordLabel}>{f}</span>
                        ))}
                    </div>
                )}

                <div className={styles.boardMiddle}>
                    {/* Rank labels (left) */}
                    {showCoordinates && (
                        <div className={styles.coordsLeft}>
                            {displayRanks.map((r, i) => (
                                <span key={r} className={styles.coordLabel}>
                                    {isFlipped ? (i + 1).toString() : (8 - i).toString()}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* The actual board */}
                    <div
                        ref={boardRef}
                        className={styles.board}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={() => setDragging(null)}
                    >
                        {Array.from({ length: 8 }).map((_, dispRow) => {
                            const actualRow = isFlipped ? 7 - dispRow : dispRow;
                            return Array.from({ length: 8 }).map((_, dispCol) => {
                                const actualCol = isFlipped ? 7 - dispCol : dispCol;
                                const square = getSquareName(actualRow, actualCol);
                                const piece = board[actualRow][actualCol];
                                const isLight = (actualRow + actualCol) % 2 === 0;
                                const isSelected = selectedSquare === square;
                                const isLegal = legalMoves.includes(square);
                                const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
                                const isKingCheck = kingSquare === square;
                                const hasCapturablePiece = isLegal && piece !== null;
                                const isDragSource = dragging?.square === square;

                                let bgColor: string;
                                if (isSelected) {
                                    bgColor = isLight ? '#A4CB6A' : '#6B8B4A';
                                } else if (isLastMoveSquare) {
                                    bgColor = isLight ? '#CDD26A' : '#AAA23A';
                                } else {
                                    bgColor = isLight ? theme.lightSquare : theme.darkSquare;
                                }

                                return (
                                    <div
                                        key={square}
                                        className={`${styles.square} ${isKingCheck ? styles.checkSquare : ''}`}
                                        style={{ backgroundColor: bgColor }}
                                        onClick={() => onSquareClick(square)}
                                        onMouseDown={(e) => handleMouseDown(e, square, piece)}
                                        data-square={square}
                                    >
                                        {/* Legal move indicator */}
                                        {isLegal && !hasCapturablePiece && (
                                            <div className={styles.legalDot} />
                                        )}

                                        {/* Capture ring */}
                                        {hasCapturablePiece && (
                                            <div className={styles.captureRing} />
                                        )}

                                        {/* Piece */}
                                        {piece && !isDragSource && (
                                            <div className={styles.pieceContainer}>
                                                <ChessPiece
                                                    type={piece.type as 'p' | 'n' | 'b' | 'r' | 'q' | 'k'}
                                                    color={piece.color as 'w' | 'b'}
                                                    size={0}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })}

                        {/* Dragging ghost piece */}
                        {dragging && (
                            <div
                                className={styles.dragGhost}
                                style={{
                                    left: dragging.x - (boardRef.current?.getBoundingClientRect().left || 0) - 30,
                                    top: dragging.y - (boardRef.current?.getBoundingClientRect().top || 0) - 30,
                                }}
                            >
                                <ChessPiece
                                    type={dragging.piece.type as 'p' | 'n' | 'b' | 'r' | 'q' | 'k'}
                                    color={dragging.piece.color as 'w' | 'b'}
                                    size={60}
                                />
                            </div>
                        )}
                    </div>

                    {/* Rank labels (right) */}
                    {showCoordinates && (
                        <div className={styles.coordsRight}>
                            {displayRanks.map((r, i) => (
                                <span key={r} className={styles.coordLabel}>
                                    {isFlipped ? (i + 1).toString() : (8 - i).toString()}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* File labels (bottom) */}
                {showCoordinates && (
                    <div className={styles.coordsBottom}>
                        {displayFiles.map((f) => (
                            <span key={f} className={styles.coordLabel}>{f}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
