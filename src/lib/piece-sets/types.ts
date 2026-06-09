/* ===================================================================
   ChessCash — Piece Set Types
   =================================================================== */

export type PieceCode =
  | 'wk' | 'wq' | 'wr' | 'wb' | 'wn' | 'wp'
  | 'bk' | 'bq' | 'br' | 'bb' | 'bn' | 'bp';

/** Raw inline-SVG data for a full 12-piece set. */
export interface PieceSvgData {
  viewBox: string;
  pieces: Record<PieceCode, string>;
}

export interface PieceSetMeta {
  id: string;
  name: string;
  description: string;
  credit?: string;
  data: PieceSvgData;
}
