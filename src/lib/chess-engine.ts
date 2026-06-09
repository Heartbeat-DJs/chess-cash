/* ===================================================================
   ChessCash — Chess Engine (chess.js wrapper)
   =================================================================== */

import { Chess } from 'chess.js';
import type { GameState, TimeControl, Square, Move, PieceColor, GameOutcome } from '@/types';
import { TIME_CONTROLS } from '@/types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function createInitialGameState(
    gameId: string,
    timeControl: TimeControl = 'blitz_3',
    status: GameState['status'] = 'active'
): GameState {
    const tc = TIME_CONTROLS[timeControl];
    const timeMs = tc.minutes * 60 * 1000;

    return {
        id: gameId,
        fen: START_FEN,
        pgn: '',
        moves: [],
        fenHistory: [START_FEN],
        turn: 'w',
        status,
        result: null,
        selectedSquare: null,
        legalMoves: [],
        lastMove: null,
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isDraw: false,
        isGameOver: false,
        whiteTime: timeMs,
        blackTime: timeMs,
        timeControl,
        moveCount: 0,
        drawOffer: null,
    };
}

export function getLegalMovesForSquare(chess: Chess, square: Square): Square[] {
    const moves = chess.moves({ square, verbose: true });
    return moves.map((m) => m.to as Square);
}

/** Milliseconds of increment for a time control. */
export function incrementMs(timeControl: TimeControl): number {
    return TIME_CONTROLS[timeControl].increment * 1000;
}

export function makeMove(
    chess: Chess,
    state: GameState,
    from: Square,
    to: Square,
    promotion?: 'q' | 'r' | 'b' | 'n'
): { newState: GameState; move: Move | null } {
    // A finished game accepts no more moves (e.g. a promotion confirmed
    // after the flag fell would otherwise resurrect a completed game)
    if (state.isGameOver || state.status === 'completed') {
        return { newState: state, move: null };
    }
    try {
        const move = chess.move({ from, to, promotion: promotion || 'q' });
        if (!move) {
            return { newState: state, move: null };
        }

        const isCheck = chess.isCheck();
        const isCheckmate = chess.isCheckmate();
        const isStalemate = chess.isStalemate();
        const isDraw = chess.isDraw();
        const isGameOver = chess.isGameOver();

        let result = state.result;
        // First move on a waiting board starts the game (and its clocks)
        let status: GameState['status'] = state.status === 'waiting' ? 'active' : state.status;

        if (isCheckmate) {
            result = state.turn === 'w' ? 'white_wins' : 'black_wins';
            status = 'completed';
        } else if (isStalemate) {
            result = 'stalemate';
            status = 'completed';
        } else if (isDraw) {
            result = 'draw';
            status = 'completed';
        }

        const newState: GameState = {
            ...state,
            fen: chess.fen(),
            pgn: chess.pgn(),
            moves: [...state.moves, move],
            fenHistory: [...state.fenHistory, chess.fen()],
            turn: chess.turn() as PieceColor,
            status,
            result,
            selectedSquare: null,
            legalMoves: [],
            lastMove: { from: move.from as Square, to: move.to as Square },
            isCheck,
            isCheckmate,
            isStalemate,
            isDraw,
            isGameOver,
            moveCount: state.moveCount + 1,
            drawOffer: null, // any move cancels an open draw offer
        };

        return { newState, move };
    } catch {
        return { newState: state, move: null };
    }
}

/** Rebuild a GameState from a chess instance after an undo (takeback). */
export function stateAfterUndo(chess: Chess, state: GameState, plies: number): GameState {
    const moves = state.moves.slice(0, Math.max(0, state.moves.length - plies));
    const fenHistory = state.fenHistory.slice(0, Math.max(1, state.fenHistory.length - plies));
    const last = moves[moves.length - 1];
    return {
        ...state,
        fen: chess.fen(),
        pgn: chess.pgn(),
        moves,
        fenHistory,
        turn: chess.turn() as PieceColor,
        status: 'active',
        result: null,
        selectedSquare: null,
        legalMoves: [],
        lastMove: last ? { from: last.from as Square, to: last.to as Square } : null,
        isCheck: chess.isCheck(),
        isCheckmate: false,
        isStalemate: false,
        isDraw: false,
        isGameOver: false,
        moveCount: moves.length,
        drawOffer: null,
    };
}

export function isPromotionMove(
    chess: Chess,
    from: Square,
    to: Square
): boolean {
    const piece = chess.get(from);
    if (!piece || piece.type !== 'p') return false;

    const rank = to.charAt(1);
    return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
}

export function formatTime(ms: number): string {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTimeDetailed(ms: number): string {
    if (ms <= 0) return '0.0';
    const totalTenths = Math.ceil(ms / 100);
    const minutes = Math.floor(totalTenths / 600);
    const seconds = Math.floor((totalTenths % 600) / 10);
    const tenths = totalTenths % 10;

    if (minutes > 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}.${tenths}`;
}

export function getGameResultText(state: GameState): string {
    if (!state.isGameOver) return '';
    switch (state.result) {
        case 'white_wins': return state.isCheckmate ? 'Checkmate — White wins' : 'White wins';
        case 'black_wins': return state.isCheckmate ? 'Checkmate — Black wins' : 'Black wins';
        case 'draw': return state.drawOffer !== null ? 'Draw by agreement' : 'Draw';
        case 'stalemate': return 'Stalemate — Draw';
        case 'timeout': return `${state.turn === 'w' ? 'Black' : 'White'} wins on time`;
        case 'resignation': return `${state.turn === 'w' ? 'Black' : 'White'} wins by resignation`;
        default: return 'Game Over';
    }
}

/** Outcome from a given player's perspective. */
export function getOutcomeForPlayer(state: GameState, playerColor: PieceColor): GameOutcome {
    if (state.result === 'white_wins') return playerColor === 'w' ? 'win' : 'loss';
    if (state.result === 'black_wins') return playerColor === 'b' ? 'win' : 'loss';
    if (state.result === 'timeout' || state.result === 'resignation') {
        // the side to move flagged / resigned
        return state.turn === playerColor ? 'loss' : 'win';
    }
    return 'draw';
}
