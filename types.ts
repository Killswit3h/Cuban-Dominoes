export type Tile = [number, number];

export interface Player {
  id: number;
  name: string;
  isBot: boolean;
  hand: Tile[];
  team: number; // 0 for User/Partner, 1 for Opponents
}

export interface GameState {
  players: Player[];
  board: Tile[]; // Ordered list of tiles on the board
  boneyard: Tile[];
  leftEnd: number | null;
  rightEnd: number | null;
  currentPlayerIndex: number; // 0=User, 1=Bot1, 2=Bot2, 3=Bot3
  status: 'idle' | 'playing' | 'round_over';
  logs: string[];
  winner: {
    team: number | null; // 0 or 1, or null for draw (unlikely)
    reason: 'domino' | 'tranque' | null;
    points: number;
  } | null;
  passHistory: { [playerId: number]: number[] }; // Track which numbers players passed on
}

export interface Move {
  tile: Tile;
  side: 'left' | 'right';
}