/* ===================================================================
   ChessCash — Piece Set Registry
   =================================================================== */

import type { PieceSetMeta } from './types';
import { CBURNETT } from './cburnett';
import { GILDED } from './gilded';
import { MERIDA } from './merida';
import { EXECUTIVE } from './executive';

export type { PieceCode, PieceSvgData, PieceSetMeta } from './types';

export const PIECE_SETS: PieceSetMeta[] = [
  {
    id: 'classic',
    name: 'Classic Staunton',
    description: 'The timeless tournament standard. Crisp, instantly readable.',
    credit: 'Pieces by Colin M.L. Burnett (CC BY-SA 3.0)',
    data: CBURNETT,
  },
  {
    id: 'gilded',
    name: 'Gilded Onyx',
    description: 'Champagne gold versus gold-trimmed onyx. The house set.',
    credit: 'Derived from Colin M.L. Burnett pieces (CC BY-SA 3.0)',
    data: GILDED,
  },
  {
    id: 'merida',
    name: 'Merida',
    description: 'Elegant engraved style favored in classical print diagrams.',
    credit: 'Pieces by Armando Hernandez Marroquin (freeware)',
    data: MERIDA,
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'Bold flat-geometric silhouettes. Boardroom minimalism.',
    data: EXECUTIVE,
  },
];

export const DEFAULT_PIECE_SET = 'classic';

export function getPieceSet(id: string): PieceSetMeta {
  return PIECE_SETS.find((s) => s.id === id) ?? PIECE_SETS[0];
}
