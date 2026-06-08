/* ===================================================================
   ChessCash — Chess Engine (chess.js wrapper)
   =================================================================== */

import { Chess } from 'chess.js';
import type { GameState, TimeControl, Square, Move, PieceColor } from '@/types';
import { TIME_CONTROLS } from '@/types';

export function createInitialGameState(
    gameId: string,
    timeControl: TimeControl = 'blitz_3'
): GameState {
    const tc = TIME_CONTROLS[timeControl];
    const timeMs = tc.minutes * 60 * 1000;

    return {
        id: gameId,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        moves: [],
        turn: 'w',
        status: 'active',
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
    };
}

export function getLegalMovesForSquare(chess: Chess, square: Square): Square[] {
    const moves = chess.moves({ square, verbose: true });
    return moves.map((m) => m.to as Square);
}

export function makeMove(
    chess: Chess,
    state: GameState,
    from: Square,
    to: Square,
    promotion?: 'q' | 'r' | 'b' | 'n'
): { newState: GameState; move: Move | null } {
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
        let status = state.status;

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
        };

        return { newState, move };
    } catch {
        return { newState: state, move: null };
    }
}

export function selectSquare(
    chess: Chess,
    state: GameState,
    square: Square
): GameState {
    const piece = chess.get(square);

    // If clicking on own piece, select it and show legal moves
    if (piece && piece.color === state.turn) {
        const legalMoves = getLegalMovesForSquare(chess, square);
        return {
            ...state,
            selectedSquare: square,
            legalMoves,
        };
    }

    // If a piece is selected and clicking on a legal move, make the move
    if (state.selectedSquare && state.legalMoves.includes(square)) {
        const { newState } = makeMove(chess, state, state.selectedSquare, square);
        return newState;
    }

    // Otherwise, deselect
    return {
        ...state,
        selectedSquare: null,
        legalMoves: [],
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
    if (ms <= 0) return '0:00.0';
    const totalTenths = Math.ceil(ms / 100);
    const minutes = Math.floor(totalTenths / 600);
    const seconds = Math.floor((totalTenths % 600) / 10);
    const tenths = totalTenths % 10;

    if (minutes > 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}.${tenths}`;
}

export function getMoveNotation(move: Move): string {
    if (move.san) return move.san;
    return `${move.from}-${move.to}`;
}

export function getGameResultText(state: GameState): string {
    if (!state.isGameOver) return '';
    switch (state.result) {
        case 'white_wins': return state.isCheckmate ? 'Checkmate — White wins!' : 'White wins!';
        case 'black_wins': return state.isCheckmate ? 'Checkmate — Black wins!' : 'Black wins!';
        case 'draw': return 'Draw by agreement';
        case 'stalemate': return 'Stalemate — Draw!';
        case 'timeout': return `${state.turn === 'w' ? 'Black' : 'White'} wins on time!`;
        case 'resignation': return `${state.turn === 'w' ? 'Black' : 'White'} wins by resignation!`;
        default: return 'Game Over';
    }
}
