import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import { useEffect, useRef } from 'react';

import type { LivingBoard, MoveIntent } from '../../chess';

import { buildDests, intentFromOrigDest, sideColor } from './boardAdapter';

import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

export interface ChessgroundBoardProps {
  readonly board: LivingBoard;
  readonly playerSide: 'w' | 'b';
  readonly interactive: boolean;
  readonly lastMove?: readonly [Key, Key];
  readonly onMove: (intent: MoveIntent) => void;
}

export function ChessgroundBoard({
  board,
  playerSide,
  interactive,
  lastMove,
  onMove,
}: ChessgroundBoardProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  const boardRef = useRef(board);
  onMoveRef.current = onMove;
  boardRef.current = board;

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;

    const config: Config = {
      fen: boardRef.current.fen(),
      orientation: sideColor(playerSide),
      coordinates: true,
      movable: {
        free: false,
        showDests: true,
        events: {
          after: (orig, dest) => {
            const intent = intentFromOrigDest(boardRef.current, orig, dest);
            if (intent !== undefined) {
              onMoveRef.current(intent);
            }
          },
        },
      },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },
    };

    apiRef.current = Chessground(element, config);
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
  }, [playerSide]);

  useEffect(() => {
    const api = apiRef.current;
    if (api === null) return;
    const canMove =
      interactive && board.turn() === playerSide && !board.isGameOver();
    api.set({
      fen: board.fen(),
      turnColor: sideColor(board.turn()),
      ...(lastMove === undefined ? {} : { lastMove: [...lastMove] as Key[] }),
      movable: canMove
        ? {
            color: sideColor(board.turn()),
            dests: buildDests(board),
          }
        : { dests: new Map<Key, Key[]>() },
      viewOnly: !canMove,
    });
  }, [board, interactive, lastMove, playerSide]);

  return <div className="cg-wrap" ref={containerRef} />;
}
