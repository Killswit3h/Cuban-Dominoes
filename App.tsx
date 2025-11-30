import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, AlertTriangle, Users, Trophy, SkipForward } from 'lucide-react';
import { GameState, Player, Tile, Move } from './types';
import { generateDeck, shuffleDeck, determineStarter, getValidMoves, calculateBotMove, calculateScores, getTileSum, isDouble, areTilesEqual } from './utils/gameLogic';
import { DominoTile } from './components/DominoTile';

// Initial Empty State
const initialGameState: GameState = {
  players: [],
  board: [],
  boneyard: [],
  leftEnd: null,
  rightEnd: null,
  currentPlayerIndex: 0,
  status: 'idle',
  logs: [],
  winner: null,
  passHistory: { 0: [], 1: [], 2: [], 3: [] }
};

const BOT_DELAY_MS = 1500;

export default function App() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.logs]);

  // Game Loop
  useEffect(() => {
    if (gameState.status !== 'playing') return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    // Check for Win Condition: Domino (Empty Hand)
    if (currentPlayer.hand.length === 0) {
      handleRoundEnd('domino', currentPlayer.team);
      return;
    }

    // Check for Lock (Tranque)
    // A lock happens when ALL players pass consecutively.
    // However, in standard play, we just check if the current player can move.
    // If everyone passed recently? Easier: Calculate valid moves for EVERYONE.
    // If NO ONE has a valid move, it's a lock.
    const allHands = gameState.players.flatMap(p => p.hand);
    const anyValidMove = gameState.players.some(p => 
      getValidMoves(p.hand, gameState.leftEnd, gameState.rightEnd).length > 0
    );

    if (!anyValidMove && gameState.board.length > 0) {
       // Tranque!
       // Determine winner by lowest pip count individually
       let minPips = 1000;
       let winningTeam = -1;
       
       // Rules vary: "Individual with lowest wins for team" is standard.
       // Ties break by who played last or highest double... let's stick to simple lowest pips.
       gameState.players.forEach(p => {
         const pips = p.hand.reduce((sum, t) => sum + getTileSum(t), 0);
         if (pips < minPips) {
           minPips = pips;
           winningTeam = p.team;
         } else if (pips === minPips) {
           // Tie breaker logic for tranque is complex. 
           // Simplification: The team of the person who made the lock usually loses if tied?
           // Let's just default to current player's team winning in a tie for simplicity of practice.
           winningTeam = p.team; 
         }
       });
       handleRoundEnd('tranque', winningTeam);
       return;
    }


    // Bot Turn Logic
    if (currentPlayer.isBot) {
      const timer = setTimeout(() => {
        executeBotTurn(currentPlayer);
      }, BOT_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      // User turn - check if forced pass
      const validMoves = getValidMoves(currentPlayer.hand, gameState.leftEnd, gameState.rightEnd);
      if (validMoves.length === 0 && gameState.board.length > 0) {
        // Auto pass for user if no moves (after a short delay for realization)
        const timer = setTimeout(() => {
           handlePass(currentPlayer);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }

  }, [gameState.currentPlayerIndex, gameState.status, gameState.board.length]);

  const startGame = () => {
    const deck = shuffleDeck(generateDeck());
    
    // Deal 10 to each
    const players: Player[] = [
      { id: 0, name: 'You', isBot: false, hand: deck.slice(0, 10), team: 0 },
      { id: 1, name: 'Bot 1 (Left)', isBot: true, hand: deck.slice(10, 20), team: 1 },
      { id: 2, name: 'Bot 2 (Partner)', isBot: true, hand: deck.slice(20, 30), team: 0 },
      { id: 3, name: 'Bot 3 (Right)', isBot: true, hand: deck.slice(30, 40), team: 1 },
    ];
    
    const boneyard = deck.slice(40);

    const { starterIndex, startTile } = determineStarter(players, boneyard);

    // Prepare initial state.
    // NOTE: In this game, the starter AUTOMATICALLY plays the card.
    
    const starter = players[starterIndex];
    // IMPORTANT: Remove using value equality, not reference
    starter.hand = starter.hand.filter(t => !areTilesEqual(t, startTile));

    const initialBoard = [startTile];
    const leftEnd = startTile[0];
    const rightEnd = startTile[1];

    // Counter-Clockwise order: 0 -> 3 -> 2 -> 1 -> 0
    const getNextPlayer = (current: number) => (current - 1 + 4) % 4;
    const actualNextIndex = getNextPlayer(starterIndex);

    setGameState({
      ...initialGameState,
      status: 'playing',
      players,
      boneyard,
      board: initialBoard,
      leftEnd,
      rightEnd,
      currentPlayerIndex: actualNextIndex,
      logs: [`Game Started. ${starter.name} leads with [${startTile[0]}|${startTile[1]}].`],
      passHistory: { 0: [], 1: [], 2: [], 3: [] }
    });
  };

  const getNextPlayerIndex = (current: number) => (current - 1 + 4) % 4;

  const handlePass = (player: Player) => {
    setGameState(prev => {
      // Record what they missed. If leftEnd is 5 and rightEnd is 9, they missed 5 and 9.
      const missed = [];
      if (prev.leftEnd !== null) missed.push(prev.leftEnd);
      if (prev.rightEnd !== null && prev.rightEnd !== prev.leftEnd) missed.push(prev.rightEnd);

      const newPassHistory = { ...prev.passHistory, [player.id]: [...prev.passHistory[player.id], ...missed] };

      return {
        ...prev,
        currentPlayerIndex: getNextPlayerIndex(prev.currentPlayerIndex),
        logs: [...prev.logs, `${player.name} passes (Knock).`],
        passHistory: newPassHistory
      };
    });
  };

  const handleRoundEnd = (reason: 'domino' | 'tranque', winningTeam: number) => {
    // Reveal hands
    setGameState(prev => {
      const scores = calculateScores(prev.players);
      const points = winningTeam === 0 ? scores.team1 : scores.team0;
      
      return {
        ...prev,
        status: 'round_over',
        winner: { team: winningTeam, reason, points },
        logs: [...prev.logs, `Round Over! ${winningTeam === 0 ? 'Your team' : 'Opponents'} won via ${reason}. Points: ${points}.`]
      };
    });
  };

  const executeBotTurn = (bot: Player) => {
    // Determine next player (opponent of bot)
    const nextPlayerId = getNextPlayerIndex(bot.id);
    
    const move = calculateBotMove(bot.hand, gameState.leftEnd, gameState.rightEnd, gameState.passHistory, nextPlayerId);

    if (move) {
      applyMove(bot.id, move.tile, move.side);
    } else {
      handlePass(bot);
    }
  };

  const applyMove = (playerId: number, tile: Tile, side: 'left' | 'right') => {
    setGameState(prev => {
      const player = prev.players.find(p => p.id === playerId)!;
      // Filter out the tile properly
      const newHand = player.hand.filter(t => !areTilesEqual(t, tile));
      const newPlayers = prev.players.map(p => p.id === playerId ? { ...p, hand: newHand } : p);
      
      let newLeft = prev.leftEnd!;
      let newRight = prev.rightEnd!;
      let newBoard = [...prev.board];
      
      if (side === 'left') {
        // Prepend
        // If leftEnd is 5. Tile is [5, 9]. New Left is 9.
        if (tile[0] === newLeft) {
          newLeft = tile[1];
        } else if (tile[1] === newLeft) {
          newLeft = tile[0];
        }
        newBoard.unshift(tile);
      } else {
        // Append
        if (tile[0] === newRight) {
           newRight = tile[1];
        } else if (tile[1] === newRight) {
           newRight = tile[0];
        }
        newBoard.push(tile);
      }

      return {
        ...prev,
        players: newPlayers,
        board: newBoard,
        leftEnd: newLeft,
        rightEnd: newRight,
        currentPlayerIndex: getNextPlayerIndex(prev.currentPlayerIndex),
        logs: [...prev.logs, `${player.name} plays [${tile[0]}|${tile[1]}] on the ${side}.`]
      };
    });
  };

  const onUserTileClick = (tile: Tile) => {
    if (gameState.currentPlayerIndex !== 0 || gameState.status !== 'playing') return;

    const validMoves = getValidMoves([tile], gameState.leftEnd, gameState.rightEnd);

    if (validMoves.length === 0) {
      return;
    } 
    
    if (validMoves.length === 1) {
      applyMove(0, tile, validMoves[0].side);
    } else {
      // Ambiguous move (can play on both ends).
      if (gameState.leftEnd === gameState.rightEnd) {
         applyMove(0, tile, 'left'); // Doesn't matter
      } else {
         const choice = window.confirm(`Play [${tile[0]}|${tile[1]}] on Left (${gameState.leftEnd}) or Right (${gameState.rightEnd})? OK for Left, Cancel for Right.`);
         applyMove(0, tile, choice ? 'left' : 'right');
      }
    }
  };

  // Rendering Helpers: Calculate orientation for the snake
  const getVisualChain = () => {
    if (gameState.board.length === 0) return [];
    
    // Greedy visual matching from left to right
    let expectedMatch = gameState.leftEnd;
    
    return gameState.board.map((tile, idx) => {
        const [a, b] = tile;
        let oriented: Tile = [a, b];
        
        // Match the "outer" side to expectedMatch
        if (a === expectedMatch) {
            oriented = [a, b];
            expectedMatch = b; // Inner becomes next match
        } else {
            oriented = [b, a];
            expectedMatch = a;
        }
        return oriented;
    });
  };

  const visualBoard = getVisualChain();

  // Players
  const user = gameState.players[0];
  const botLeft = gameState.players[1];
  const botPartner = gameState.players[2];
  const botRight = gameState.players[3];

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 font-sans flex flex-col md:flex-row overflow-hidden">
      
      {/* Sidebar / Info Panel */}
      <div className="w-full md:w-80 bg-stone-800 border-r border-stone-700 flex flex-col shadow-xl z-20">
        <div className="p-4 border-b border-stone-700 bg-stone-900">
          <h1 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
            <Trophy className="w-5 h-5" /> Cuban Double-9
          </h1>
          <p className="text-xs text-stone-400 mt-1">Practice Mode • Counter-Clockwise</p>
        </div>

        {/* Score Board */}
        <div className="p-4 border-b border-stone-700">
          <div className="flex justify-between items-center bg-stone-700 rounded-lg p-3">
             <div className="text-center">
               <div className="text-xs text-stone-400 uppercase font-bold">You & Bot 2</div>
               <div className="text-2xl font-bold text-green-400">
                  {gameState.winner?.team === 0 ? `+${gameState.winner.points}` : '0'}
               </div>
             </div>
             <div className="text-stone-500">vs</div>
             <div className="text-center">
               <div className="text-xs text-stone-400 uppercase font-bold">Bots 1 & 3</div>
               <div className="text-2xl font-bold text-red-400">
                 {gameState.winner?.team === 1 ? `+${gameState.winner.points}` : '0'}
               </div>
             </div>
          </div>
        </div>

        {/* Game Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm" ref={scrollRef}>
          {gameState.logs.length === 0 && <span className="text-stone-500 italic">Game logs will appear here...</span>}
          {gameState.logs.map((log, i) => (
            <div key={i} className={`pb-1 border-b border-stone-700/50 ${log.includes('You') ? 'text-yellow-200' : 'text-stone-300'}`}>
              <span className="opacity-50 mr-2">[{i + 1}]</span>{log}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-stone-700 bg-stone-900">
          {gameState.status === 'idle' || gameState.status === 'round_over' ? (
            <button 
              onClick={startGame}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-stone-900 font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {gameState.status === 'idle' ? <Play className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
              {gameState.status === 'idle' ? 'Start Game' : 'Play Again'}
            </button>
          ) : (
            <div className="text-center text-stone-400 text-sm animate-pulse">
              Game in progress...
            </div>
          )}
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 relative bg-emerald-900 flex flex-col">
        {/* Felt Texture Overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")` }}></div>

        {/* Players Layout */}
        <div className="flex-1 flex flex-col relative z-10 p-4">
          
          {/* Top: Partner (Bot 2) */}
          <div className="h-24 flex justify-center items-start">
             <PlayerArea player={botPartner} isActive={gameState.currentPlayerIndex === 2} />
          </div>

          {/* Middle: Left (Bot 1) - Board - Right (Bot 3) */}
          <div className="flex-1 flex overflow-hidden">
             <div className="w-24 flex items-center justify-start z-10">
               <PlayerArea player={botLeft} isActive={gameState.currentPlayerIndex === 1} vertical />
             </div>

             {/* The Snake (Board) */}
             <div className="flex-1 flex items-center justify-center p-2 overflow-hidden relative">
                {/* Scrollable Container */}
                <div className="w-full overflow-x-auto p-6 bg-emerald-800/50 rounded-2xl shadow-inner min-h-[180px] border border-emerald-700/30 flex items-center scrollbar-thin scrollbar-thumb-emerald-600">
                   <div className="flex items-center mx-auto gap-0.5 min-w-min px-4">
                      {visualBoard.length === 0 && (
                        <div className="text-emerald-200/50 italic whitespace-nowrap">Waiting for start...</div>
                      )}
                      {visualBoard.map((tile, i) => (
                        <div key={i} className="flex-shrink-0">
                          <DominoTile 
                             tile={tile} 
                             size="md"
                             orientation={isDouble(tile) ? 'vertical' : 'horizontal'}
                          />
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="w-24 flex items-center justify-end z-10">
                <PlayerArea player={botRight} isActive={gameState.currentPlayerIndex === 3} vertical />
             </div>
          </div>

          {/* Bottom: User */}
          <div className="h-40 flex flex-col justify-end items-center pb-4">
             <div className={`
                flex gap-2 p-4 rounded-xl transition-all duration-300
                ${gameState.currentPlayerIndex === 0 ? 'bg-yellow-500/10 ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/10' : 'bg-black/20'}
             `}>
                {user && user.hand.map((tile, i) => {
                  const isValid = gameState.currentPlayerIndex === 0 && gameState.status === 'playing' && 
                                  getValidMoves([tile], gameState.leftEnd, gameState.rightEnd).length > 0;
                  return (
                    <div key={i} className={`${isValid ? '-mt-4' : ''} transition-all duration-200`}>
                      <DominoTile 
                        tile={tile} 
                        size="lg" 
                        selectable={isValid}
                        disabled={gameState.currentPlayerIndex !== 0 || gameState.status !== 'playing' || (!isValid && gameState.board.length > 0)}
                        highlight={isValid}
                        onClick={() => onUserTileClick(tile)}
                      />
                    </div>
                  );
                })}
             </div>
             <div className="text-stone-300 font-bold mt-2 flex gap-2 items-center">
                <Users className="w-4 h-4" /> You {gameState.currentPlayerIndex === 0 && <span className="text-yellow-400 text-xs animate-bounce">(Your Turn)</span>}
             </div>
          </div>

        </div>

        {/* Boneyard Reveal (End of Game) */}
        {gameState.status === 'round_over' && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
            <div className="bg-stone-800 p-8 rounded-2xl max-w-4xl w-full border border-stone-600 shadow-2xl">
               <h2 className="text-3xl font-bold text-white mb-6 text-center">Round Summary</h2>
               
               <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="bg-stone-900 p-4 rounded-lg">
                    <h3 className="text-green-400 font-bold mb-2">Winner</h3>
                    <p className="text-2xl text-white">
                      {gameState.winner?.team === 0 ? 'You & Bot 2' : 'Bots 1 & 3'}
                    </p>
                    <p className="text-stone-400 capitalize">{gameState.winner?.reason}</p>
                  </div>
                  <div className="bg-stone-900 p-4 rounded-lg">
                    <h3 className="text-yellow-400 font-bold mb-2">Points</h3>
                    <p className="text-2xl text-white">{gameState.winner?.points}</p>
                  </div>
               </div>

               <h3 className="text-stone-400 mb-4 text-sm font-bold uppercase tracking-wider">Unplayed Tiles (Boneyard + Hands)</h3>
               <div className="flex flex-wrap gap-2 justify-center">
                  {/* Show Boneyard */}
                  {gameState.boneyard.map((tile, i) => (
                    <div key={`bone-${i}`} className="opacity-75">
                      <DominoTile tile={tile} size="sm" />
                    </div>
                  ))}
                  {/* Show Opponent Hands */}
                  {gameState.players.slice(1).flatMap(p => p.hand).map((tile, i) => (
                     <div key={`opp-${i}`} className="opacity-75 relative">
                        <DominoTile tile={tile} size="sm" />
                        <div className="absolute inset-0 bg-red-500/10 pointer-events-none"></div>
                     </div>
                  ))}
               </div>

               <button 
                onClick={startGame}
                className="mt-8 w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-stone-900 font-bold rounded-xl shadow-lg transition-all"
               >
                 Start New Round
               </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const PlayerArea = ({ player, isActive, vertical }: { player: Player | undefined, isActive: boolean, vertical?: boolean }) => {
  if (!player) return null;
  
  return (
    <div className={`
      flex flex-col items-center gap-2 transition-all duration-300
      ${isActive ? 'scale-110' : 'opacity-70'}
    `}>
       {/* Avatar / Icon */}
       <div className={`
         w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-lg
         ${isActive ? 'bg-yellow-500 border-white text-stone-900' : 'bg-stone-700 border-stone-600 text-stone-400'}
       `}>
          <span className="font-bold text-lg">{player.name.split(' ')[2]?.[0] || player.name[0]}</span>
       </div>
       
       {/* Name & Tile Count */}
       <div className={`
          bg-stone-800/90 px-3 py-1 rounded-full text-xs font-mono border border-stone-600 text-center
          ${vertical ? 'w-24' : ''}
       `}>
          <div className="text-white font-bold truncate">{player.name}</div>
          <div className="text-stone-400">{player.hand.length} tiles</div>
       </div>

       {/* Back of Tiles Visual */}
       <div className="flex -space-x-1 h-6">
          {Array.from({ length: player.hand.length }).map((_, i) => (
             <div key={i} className="w-4 h-6 bg-stone-200 rounded-sm border border-stone-400 shadow-sm" />
          ))}
       </div>
    </div>
  );
};