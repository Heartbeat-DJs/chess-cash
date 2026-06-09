/* ===================================================================
   ChessCash — AI Web Worker
   Runs engine computation off the main thread. Supports move
   selection, hints, and position evaluation, multiplexed by id.
   =================================================================== */

import { Chess } from 'chess.js';
import { getAIMove, getHintMove, searchScore, type AIDifficulty } from './chess-ai';

export type AIWorkerRequest =
  | { kind: 'move'; id: number; fen: string; difficulty: AIDifficulty; remainingTimeMs?: number }
  | { kind: 'hint'; id: number; fen: string }
  | { kind: 'eval'; id: number; fen: string; depth?: number };

export type AIWorkerResponse =
  | { kind: 'move'; id: number; move: { from: string; to: string; promotion?: string } | null }
  | { kind: 'hint'; id: number; move: { from: string; to: string } | null }
  | { kind: 'eval'; id: number; score: number };

self.onmessage = (e: MessageEvent<AIWorkerRequest>) => {
  const req = e.data;

  try {
    const chess = new Chess(req.fen);

    switch (req.kind) {
      case 'move': {
        const move = getAIMove(chess, req.difficulty, req.remainingTimeMs);
        self.postMessage({
          kind: 'move',
          id: req.id,
          move: { from: move.from, to: move.to, promotion: move.promotion },
        } satisfies AIWorkerResponse);
        break;
      }
      case 'hint': {
        const move = getHintMove(chess);
        self.postMessage({
          kind: 'hint',
          id: req.id,
          move: move ? { from: move.from, to: move.to } : null,
        } satisfies AIWorkerResponse);
        break;
      }
      case 'eval': {
        const score = searchScore(chess, req.depth ?? 2);
        self.postMessage({ kind: 'eval', id: req.id, score } satisfies AIWorkerResponse);
        break;
      }
    }
  } catch {
    if (req.kind === 'eval') {
      self.postMessage({ kind: 'eval', id: req.id, score: 0 } satisfies AIWorkerResponse);
    } else {
      self.postMessage({ kind: req.kind, id: req.id, move: null } satisfies AIWorkerResponse);
    }
  }
};
