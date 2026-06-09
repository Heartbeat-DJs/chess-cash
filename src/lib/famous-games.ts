/* ===================================================================
   ChessCash — Famous Games
   Move lists (SAN) for showcase boards that replay classics.
   =================================================================== */

export interface FamousGame {
  id: string;
  title: string;
  players: string;
  year: number;
  moves: string[]; // SAN, alternating white/black
}

export const OPERA_GAME: FamousGame = {
  id: 'opera',
  title: 'The Opera Game',
  players: 'Morphy vs. Duke Karl & Count Isouard',
  year: 1858,
  moves: [
    'e4', 'e5',
    'Nf3', 'd6',
    'd4', 'Bg4',
    'dxe5', 'Bxf3',
    'Qxf3', 'dxe5',
    'Bc4', 'Nf6',
    'Qb3', 'Qe7',
    'Nc3', 'c6',
    'Bg5', 'b5',
    'Nxb5', 'cxb5',
    'Bxb5+', 'Nbd7',
    'O-O-O', 'Rd8',
    'Rxd7', 'Rxd7',
    'Rd1', 'Qe6',
    'Bxd7+', 'Nxd7',
    'Qb8+', 'Nxb8',
    'Rd8#',
  ],
};

export const IMMORTAL_GAME: FamousGame = {
  id: 'immortal',
  title: 'The Immortal Game',
  players: 'Anderssen vs. Kieseritzky',
  year: 1851,
  moves: [
    'e4', 'e5',
    'f4', 'exf4',
    'Bc4', 'Qh4+',
    'Kf1', 'b5',
    'Bxb5', 'Nf6',
    'Nf3', 'Qh6',
    'd3', 'Nh5',
    'Nh4', 'Qg5',
    'Nf5', 'c6',
    'g4', 'Nf6',
    'Rg1', 'cxb5',
    'h4', 'Qg6',
    'h5', 'Qg5',
    'Qf3', 'Ng8',
    'Bxf4', 'Qf6',
    'Nc3', 'Bc5',
    'Nd5', 'Qxb2',
    'Bd6', 'Bxg1',
    'e5', 'Qxa1+',
    'Ke2', 'Na6',
    'Nxg7+', 'Kd8',
    'Qf6+', 'Nxf6',
    'Be7#',
  ],
};

export const FAMOUS_GAMES: FamousGame[] = [OPERA_GAME, IMMORTAL_GAME];
