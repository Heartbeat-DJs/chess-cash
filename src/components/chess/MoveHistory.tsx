/* ===================================================================
   ChessCash — Move History Component
   =================================================================== */

'use client';

import React, { useRef, useEffect } from 'react';
import type { Move } from '@/types';
import styles from './MoveHistory.module.css';

interface MoveHistoryProps {
    moves: Move[];
    currentMoveIndex?: number;
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [moves.length]);

    // Group moves into pairs (white + black)
    const movePairs: { number: number; white: Move; black?: Move }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
        movePairs.push({
            number: Math.floor(i / 2) + 1,
            white: moves[i],
            black: moves[i + 1],
        });
    }

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
                            <span className={styles.move}>{pair.white.san}</span>
                            {pair.black && (
                                <span className={styles.move}>{pair.black.san}</span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
