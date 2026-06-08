/* ===================================================================
   ChessCash — AI Web Worker
   Runs minimax/AI computation off the main thread so the timer
   and UI continue updating smoothly during AI thinking.
   =================================================================== */

import { Chess } from 'chess.js';
import { getAIMove, type AIDifficulty } from './chess-ai';

export interface AIWorkerRequest {
  fen: string;
  difficulty: AIDifficulty;
  remainingTimeMs?: number;
}

export interface AIWorkerResponse {
  from: string;
  to: string;
  promotion?: string;
}

self.onmessage = (e: MessageEvent<AIWorkerRequest>) => {
  const { fen, difficulty, remainingTimeMs } = e.data;

  try {
    const chess = new Chess(fen);
    const move = getAIMove(chess, difficulty, remainingTimeMs);

    const response: AIWorkerResponse = {
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    };

    self.postMessage(response);
  } catch {
    // No legal moves — post null
    self.postMessage(null);
  }
};
