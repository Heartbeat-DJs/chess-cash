/* ===================================================================
   ChessCash — Move History
   Clickable move list with navigation controls.
   =================================================================== */

'use client';

import React, { useRef, useEffect } from 'react';
import type { Move } from '@/types';
import styles from './MoveHistory.module.css';

interface MoveHistoryProps {
    moves: Move[];
    /** Currently viewed ply (1-based: ply 1 = after White's first move). */
    currentPly?: number;
    isLive?: boolean;
    onSelectPly?: (ply: number) => void;
    onStart?: () => void;
    onBack?: () => void;
    onForward?: () => void;
    onLive?: () => void;
}

export default function MoveHistory({
    moves,
    currentPly,
    isLive = true,
    onSelectPly,
    onStart,
    onBack,
    onForward,
    onLive,
}: MoveHistoryProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current && isLive) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [moves.length, isLive]);

    const movePairs: { number: number; white: Move; whitePly: number; black?: Move; blackPly?: number }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
        movePairs.push({
            number: Math.floor(i / 2) + 1,
            white: moves[i],
            whitePly: i + 1,
            black: moves[i + 1],
            blackPly: moves[i + 1] ? i + 2 : undefined,
        });
    }

    const activePly = isLive ? moves.length : currentPly;
    const hasNav = Boolean(onBack || onForward);

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <span className={styles.title}>Moves</span>
                <span className={styles.count}>{moves.length}</span>
            </div>
            <div className={styles.moveList} ref={scrollRef}>
                {movePairs.length === 0 ? (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>♟</span>
                        <span>No moves yet</span>
                    </div>
                ) : (
                    movePairs.map((pair) => (
                        <div key={pair.number} className={styles.movePair}>
                            <span className={styles.moveNumber}>{pair.number}.</span>
                            <button
                                className={`${styles.move} ${activePly === pair.whitePly ? styles.moveActive : ''}`}
                                onClick={() => onSelectPly?.(pair.whitePly)}
                            >
                                {pair.white.san}
                            </button>
                            {pair.black && (
                                <button
                                    className={`${styles.move} ${activePly === pair.blackPly ? styles.moveActive : ''}`}
                                    onClick={() => pair.blackPly && onSelectPly?.(pair.blackPly)}
                                >
                                    {pair.black.san}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
            {hasNav && (
                <div className={styles.navRow}>
                    <button className={styles.navBtn} onClick={onStart} aria-label="First move" disabled={moves.length === 0}>⏮</button>
                    <button className={styles.navBtn} onClick={onBack} aria-label="Previous move" disabled={moves.length === 0}>◀</button>
                    <button className={styles.navBtn} onClick={onForward} aria-label="Next move" disabled={isLive}>▶</button>
                    <button className={styles.navBtn} onClick={onLive} aria-label="Latest move" disabled={isLive}>⏭</button>
                </div>
            )}
        </div>
    );
}
