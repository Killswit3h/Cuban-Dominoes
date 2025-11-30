import React from 'react';
import { Tile } from '../types';

interface DominoTileProps {
  tile: Tile;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'vertical' | 'horizontal';
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
  selectable?: boolean;
}

const getDotPosition = (n: number, index: number): string => {
  // 3x3 Grid mappings
  // 0 1 2
  // 3 4 5
  // 6 7 8
  
  const positions: Record<number, number[]> = {
    0: [],
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 1, 2, 6, 7, 8], // Standard 6 is two rows of 3 usually, or column. Let's do horizontal rows for horizontal tiles.
    7: [0, 2, 3, 4, 5, 6, 8], // H form
    8: [0, 1, 2, 3, 5, 6, 7, 8], // Box with middle empty? Or standard 8. Let's do 2 columns of 3 + middle 2.
    9: [0, 1, 2, 3, 4, 5, 6, 7, 8], // Full grid
  };

  // Override specific layouts to look more like standard dominoes
  // This is a simplified grid mapper.
  return "";
};

// Simplified Dot Renderer using grid-template-areas concept
const Pips = ({ number, color }: { number: number, color: string }) => {
  // 9 grid cells
  const pips = Array(9).fill(false);
  
  if (number === 1) [4].forEach(i => pips[i] = true);
  if (number === 2) [0, 8].forEach(i => pips[i] = true);
  if (number === 3) [0, 4, 8].forEach(i => pips[i] = true);
  if (number === 4) [0, 2, 6, 8].forEach(i => pips[i] = true);
  if (number === 5) [0, 2, 4, 6, 8].forEach(i => pips[i] = true);
  if (number === 6) [0, 2, 3, 5, 6, 8].forEach(i => pips[i] = true); // 2 cols of 3
  if (number === 7) [0, 2, 3, 4, 5, 6, 8].forEach(i => pips[i] = true);
  if (number === 8) [0, 1, 2, 3, 5, 6, 7, 8].forEach(i => pips[i] = true);
  if (number === 9) [0, 1, 2, 3, 4, 5, 6, 7, 8].forEach(i => pips[i] = true);

  return (
    <div className={`grid grid-cols-3 grid-rows-3 gap-[1px] w-full h-full p-[2px]`}>
      {pips.map((active, i) => (
        <div key={i} className={`flex items-center justify-center`}>
          {active && <div className={`rounded-full ${color} w-[80%] h-[80%]`} />}
        </div>
      ))}
    </div>
  );
};

export const DominoTile: React.FC<DominoTileProps> = ({ 
  tile, 
  size = 'md', 
  orientation = 'vertical', 
  onClick, 
  disabled,
  highlight,
  selectable
}) => {
  const [top, bottom] = tile;
  
  const sizeClasses = {
    sm: 'w-6 h-12 text-[4px]',
    md: 'w-10 h-20 text-[6px]',
    lg: 'w-14 h-28 text-[8px]',
  };
  
  // Swap width/height for horizontal
  const dims = size === 'sm' ? (orientation === 'vertical' ? 'w-8 h-16' : 'w-16 h-8') :
               size === 'md' ? (orientation === 'vertical' ? 'w-12 h-24' : 'w-24 h-12') :
                               (orientation === 'vertical' ? 'w-16 h-32' : 'w-32 h-16');

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`
        ${dims} 
        bg-white rounded-md border-2 border-slate-300 shadow-sm
        flex ${orientation === 'vertical' ? 'flex-col' : 'flex-row'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${selectable && !disabled ? 'hover:-translate-y-1 hover:shadow-lg transition-transform' : ''}
        ${highlight ? 'ring-4 ring-yellow-400' : ''}
        relative select-none
      `}
    >
      {/* Top/Left Half */}
      <div className="flex-1 w-full h-full">
        <Pips number={top} color={top === 0 ? 'bg-transparent' : getPipColor(top)} />
      </div>

      {/* Divider */}
      <div className={`${orientation === 'vertical' ? 'h-[1px] w-full' : 'w-[1px] h-full'} bg-slate-300`} />

      {/* Bottom/Right Half */}
      <div className="flex-1 w-full h-full">
         <Pips number={bottom} color={bottom === 0 ? 'bg-transparent' : getPipColor(bottom)} />
      </div>
    </div>
  );
};

// Cuban style colors often distinguish numbers, or just black. Let's do colors for easier reading.
const getPipColor = (n: number) => {
  switch(n) {
    case 1: return 'bg-cyan-500';
    case 2: return 'bg-slate-900';
    case 3: return 'bg-red-500';
    case 4: return 'bg-blue-600';
    case 5: return 'bg-green-600';
    case 6: return 'bg-yellow-500';
    case 7: return 'bg-pink-600';
    case 8: return 'bg-emerald-800';
    case 9: return 'bg-purple-700';
    default: return 'bg-black';
  }
};
