import { useEffect, useMemo, useState } from 'react';

import type { Side } from '../chess';
import { createFakeEnginePort } from '../engine/fake';
import { lineFor } from '../narrative';
import type {
  MatchResult,
  MatchRecord,
  OpponentArchetype,
  PieceIdentityRecord,
  StoredPieceState,
} from '../persistence';
import {
  MatchSession,
  type MatchSessionSnapshot,
} from '../orchestration/matchSession';
import { classifyMatchResult } from '../orchestration/terminalState';
import type { MatchEvent } from '../psychology';
import { activeLineup } from '../orchestration/rosterActions';
import { mergePlayerSquadAfterMatch } from './squadCareer';
import { ChessgroundBoard } from '../ui/board/ChessgroundBoard';
import { PieceOverlay } from '../ui/overlays/PieceOverlay';
import {
  DesertionPanel,
  DialogueBubble,
  OverridePanel,
  QuietQuitPanel,
} from '../ui/panels/VerdictPanels';
import { RelationshipInspector } from '../ui/panels/RelationshipInspector';

function phaseLabel(
  phase: MatchSessionSnapshot['phase'],
  playerSide: Side,
  currentTurn: () => Side,
): string {
  if (phase === 'rout') return 'Rout — roster shattered';
  if (phase === 'succession_spectate') {
    return 'Dismissed — the King commands the remainder';
  }
  if (phase === 'game_over') return 'Match over';
  if (phase === 'awaiting_player') return 'Awaiting your decision';
  if (phase === 'thinking') return 'Consulting the pieces…';
  return currentTurn() === playerSide ? 'Your command' : 'Opponent moving…';
}

function useMatchSession(
  seed: number,
  initialRoster: readonly StoredPieceState[],
  initialLineup: readonly StoredPieceState[] | undefined,
  opponentArchetype: OpponentArchetype,
  rosterPreamble: readonly MatchEvent[],
): {
  readonly snapshot: MatchSessionSnapshot;
  readonly session: MatchSession;
  readonly refresh: () => void;
} {
  const [session] = useState(
    () =>
      new MatchSession({
        seed,
        engine: createFakeEnginePort('ui-fake/depth-fixed'),
        initialRoster:
          initialLineup === undefined
            ? activeLineup(initialRoster)
            : initialLineup.map(({ status, ...piece }) => {
                void status;
                return piece;
              }),
        ...(initialLineup === undefined
          ? {}
          : {
              initialLineup: initialLineup.map(({ status, ...piece }) => {
                void status;
                return piece;
              }),
            }),
        opponentArchetype,
        rosterPreamble,
      }),
  );
  const [, setRevision] = useState(0);
  const refresh = (): void => setRevision((value) => value + 1);
  return { snapshot: session.snapshot(), session, refresh };
}

export interface MatchScreenProps {
  readonly seed?: number;
  readonly initialRoster?: readonly StoredPieceState[];
  readonly initialLineup?: readonly StoredPieceState[];
  readonly matchIndex?: number;
  readonly opponentArchetype?: OpponentArchetype;
  readonly rosterPreamble?: readonly MatchEvent[];
  readonly identities?: readonly PieceIdentityRecord[];
  readonly matches?: readonly MatchRecord[];
  readonly onMatchFinished?: (input: {
    readonly events: MatchSessionSnapshot['events'];
    readonly rosterEnd: StoredPieceState[];
    readonly result: MatchResult;
    readonly winScore: number;
    readonly engineAudit: MatchSessionSnapshot['engineAudit'];
  }) => void;
}

export function MatchScreen({
  seed = 42,
  initialRoster,
  initialLineup,
  matchIndex = 1,
  opponentArchetype = 'random',
  rosterPreamble = [],
  identities = [],
  matches = [],
  onMatchFinished,
}: MatchScreenProps): JSX.Element {
  const rosterForMatch = initialRoster ?? [];
  const { snapshot, session, refresh } = useMatchSession(
    seed,
    rosterForMatch,
    initialLineup,
    opponentArchetype,
    rosterPreamble,
  );
  const { board, roster, phase, pending, dialogueCue, playerSide } = snapshot;
  const [reported, setReported] = useState(false);
  const namePropsFor = (
    pieceId: string,
  ): { readonly name: string } | Record<string, never> => {
    const name = identities.find((identity) => identity.id === pieceId)?.name;
    return name === undefined ? {} : { name };
  };

  const dialogueLine = useMemo(() => {
    if (dialogueCue === null) return null;
    const piece = roster.find((p) => p.id === dialogueCue.pieceId);
    if (piece === undefined) return null;
    return lineFor({
      cue: dialogueCue,
      pieceRole: piece.role,
      trust: piece.T_i,
      credence: piece.credence,
      ply: snapshot.ply,
      seed,
    });
  }, [dialogueCue, roster, seed, snapshot.ply]);

  const interactive =
    phase === 'playing' && board.turn() === playerSide && !board.isGameOver();

  const playerPieces = board.piecesOf(playerSide);

  useEffect(() => {
    if (
      reported ||
      onMatchFinished === undefined ||
      (phase !== 'game_over' && phase !== 'rout')
    ) {
      return;
    }

    const merged = mergePlayerSquadAfterMatch({
      roster: rosterForMatch,
      identities,
      matches,
      fieldedRoster: initialLineup ?? rosterForMatch,
      matchRoster: roster,
      events: snapshot.events,
      match: matchIndex,
    });
    const result = classifyMatchResult({
      rout: snapshot.rout,
      winScore: snapshot.winScore,
      dismissed: snapshot.dismissed,
    });
    setReported(true);
    onMatchFinished({
      events: [...snapshot.events, ...merged.events],
      rosterEnd: merged.roster,
      result,
      winScore: snapshot.winScore,
      engineAudit: snapshot.engineAudit,
    });
  }, [
    onMatchFinished,
    phase,
    reported,
    roster,
    rosterForMatch,
    initialLineup,
    identities,
    matches,
    matchIndex,
    snapshot.events,
    snapshot.rout,
    snapshot.winScore,
  ]);

  return (
    <div className="match-screen">
      <header className="match-screen__header">
        <h1>The Kings and I</h1>
        <p className="match-screen__status">
          Ply {snapshot.ply} ·{' '}
          {phaseLabel(phase, playerSide, () => board.turn())}
        </p>
      </header>

      <div className="match-screen__layout">
        <div className="match-screen__board-column">
          <div className="board-stack">
            <ChessgroundBoard
              board={board}
              playerSide={playerSide}
              interactive={interactive}
              {...(snapshot.lastMove === null
                ? {}
                : { lastMove: [snapshot.lastMove[0], snapshot.lastMove[1]] })}
              onMove={(intent) => {
                void session.submitPlayerIntent(intent).then(() => {
                  refresh();
                });
                refresh();
              }}
            />
            <div className="board-stack__overlays">
              {playerPieces.map((piece) => {
                const state = roster.find((p) => p.id === piece.id);
                if (state === undefined) return null;
                return (
                  <PieceOverlay
                    key={piece.id}
                    piece={state}
                    {...namePropsFor(piece.id)}
                    square={piece.square}
                    selected={snapshot.selectedPieceId === piece.id}
                    onSelect={() => {
                      session.selectPiece(
                        snapshot.selectedPieceId === piece.id ? null : piece.id,
                      );
                      refresh();
                    }}
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

          {dialogueCue?.eventKind === 'quiet_quit' && pending === null ? (
            <QuietQuitPanel
              {...namePropsFor(dialogueCue.pieceId)}
              role={
                roster.find((p) => p.id === dialogueCue.pieceId)?.role ??
                'Piece'
              }
              san={dialogueCue.san}
              trust={roster.find((p) => p.id === dialogueCue.pieceId)?.T_i ?? 0}
            />
          ) : null}

          {pending?.verdict === 'MORAL_REFUSAL' ? (
            <OverridePanel
              pending={pending}
              {...namePropsFor(pending.actor.id)}
              onOverride={() => {
                void session.confirmOverride().then(() => {
                  refresh();
                });
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
              {...namePropsFor(pending.actor.id)}
              onAcknowledge={() => {
                void session.acknowledgeDesertion().then(() => {
                  refresh();
                });
              }}
            />
          ) : null}

          {phase === 'succession_spectate' ? (
            <div className="verdict-panel verdict-panel--succession">
              <h2>Succession coda</h2>
              <p>
                Dismissed. The King commands the remainder — you spectate with
                no authority (ADR 0022).
              </p>
              <div className="roster-screen__actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void session.stepSuccession().then(() => {
                      refresh();
                    });
                  }}
                >
                  Step King&apos;s move
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void session.fastForwardSuccession().then(() => {
                      refresh();
                    });
                  }}
                >
                  Fast-forward to end
                </button>
              </div>
            </div>
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
