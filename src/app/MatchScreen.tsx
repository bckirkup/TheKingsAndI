import { useMemo, useState } from 'react';

import { lineFor } from '../narrative';
import {
  MatchSession,
  type MatchSessionSnapshot,
} from '../orchestration/matchSession';
import { ChessgroundBoard } from '../ui/board/ChessgroundBoard';
import { PieceOverlay } from '../ui/overlays/PieceOverlay';
import {
  DesertionPanel,
  DialogueBubble,
  OverridePanel,
} from '../ui/panels/VerdictPanels';
import { RelationshipInspector } from '../ui/panels/RelationshipInspector';

function useMatchSession(seed: number): {
  readonly snapshot: MatchSessionSnapshot;
  readonly session: MatchSession;
  readonly refresh: () => void;
} {
  const [session] = useState(() => new MatchSession({ seed }));
  const [revision, setRevision] = useState(0);
  const refresh = (): void => setRevision((value) => value + 1);
  void revision;
  return { snapshot: session.snapshot(), session, refresh };
}

export interface MatchScreenProps {
  readonly seed?: number;
}

export function MatchScreen({ seed = 42 }: MatchScreenProps): JSX.Element {
  const { snapshot, session, refresh } = useMatchSession(seed);
  const { board, roster, phase, pending, dialogueCue, playerSide } = snapshot;

  const dialogueLine = useMemo(() => {
    if (dialogueCue === null) return null;
    const piece = roster.find((p) => p.id === dialogueCue.pieceId);
    if (piece === undefined) return null;
    return lineFor({
      cue: dialogueCue,
      pieceRole: piece.role,
      trust: piece.T_i,
      ply: snapshot.ply,
      seed,
    });
  }, [dialogueCue, roster, seed, snapshot.ply]);

  const interactive =
    phase === 'playing' && board.turn() === playerSide && !board.isGameOver();

  const playerPieces = board.piecesOf(playerSide);

  return (
    <div className="match-screen">
      <header className="match-screen__header">
        <h1>The Kings and I</h1>
        <p className="match-screen__status">
          Ply {snapshot.ply} ·{' '}
          {phase === 'rout'
            ? 'Rout — roster shattered'
            : phase === 'game_over'
              ? 'Match over'
              : phase === 'awaiting_player'
                ? 'Awaiting your decision'
                : board.turn() === playerSide
                  ? 'Your command'
                  : 'Opponent moving…'}
        </p>
      </header>

      <div className="match-screen__layout">
        <div className="match-screen__board-column">
          <div className="board-stack">
            <ChessgroundBoard
              board={board}
              playerSide={playerSide}
              interactive={interactive}
              onMove={(intent) => {
                session.submitPlayerIntent(intent);
                refresh();
              }}
            />
            <div className="board-stack__overlays" aria-hidden>
              {playerPieces.map((piece) => {
                const state = roster.find((p) => p.id === piece.id);
                if (state === undefined) return null;
                return (
                  <PieceOverlay
                    key={piece.id}
                    piece={state}
                    square={piece.square}
                    selected={snapshot.selectedPieceId === piece.id}
                  />
                );
              })}
            </div>
          </div>

          {dialogueLine !== null && dialogueCue !== null ? (
            <DialogueBubble
              speaker={
                roster.find((p) => p.id === dialogueCue.pieceId)?.role ??
                'Piece'
              }
              line={dialogueLine}
            />
          ) : null}
        </div>

        <aside className="match-screen__sidebar">
          <RelationshipInspector
            roster={roster}
            selectedPieceId={snapshot.selectedPieceId}
          />

          {pending?.verdict === 'MORAL_REFUSAL' ? (
            <OverridePanel
              pending={pending}
              onOverride={() => {
                session.confirmOverride();
                refresh();
              }}
              onReplan={() => {
                session.replanAfterRefusal();
                refresh();
              }}
            />
          ) : null}

          {pending?.verdict === 'DESERTION_MUTINY' ? (
            <DesertionPanel
              pending={pending}
              onAcknowledge={() => {
                session.acknowledgeDesertion();
                refresh();
              }}
            />
          ) : null}

          {phase === 'rout' ? (
            <div className="verdict-panel verdict-panel--rout">
              <h2>Rout</h2>
              <p>
                Your army has collapsed. Only the King remains — the match
                cannot continue as fought.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
