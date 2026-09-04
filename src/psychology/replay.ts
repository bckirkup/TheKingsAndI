import { canonicalJson } from '../core/canonicalJson';
import { createSeededRandom } from '../core/random';
import { applyDesertionWithCascade } from './cascade';
import { shouldDesert } from './desertion';
import { appendEvent } from './events';
import { applyOverride } from './override';
import { defaultCredence, defaultRumor, normalizePieceState } from './reducers';
import type {
  MatchEvent,
  PieceState,
  ReplayManifest,
  ReplayPly,
  ReplayResult,
} from './types';
import { evaluateMoveResponse } from './verdict';

function findPiece(
  roster: readonly PieceState[],
  pieceId: string,
): PieceState | undefined {
  return roster.find((piece) => piece.id === pieceId);
}

function commitPly(
  roster: PieceState[],
  events: readonly MatchEvent[],
  ply: number,
  replayPly: ReplayPly,
): { readonly roster: PieceState[]; readonly events: readonly MatchEvent[] } {
  const actor = findPiece(roster, replayPly.pieceId);
  if (actor === undefined) return { roster, events };

  const outcome = evaluateMoveResponse(
    actor,
    replayPly.moveEval,
    roster,
    replayPly.desertionContext,
  );

  if (outcome.verdict === 'MORAL_REFUSAL' && replayPly.forced !== true) {
    return {
      roster,
      events: appendEvent(events, {
        t: 'REFUSAL',
        ply,
        pieceId: actor.id,
        utility: outcome.utilityScore,
        threshold: outcome.refusalThreshold,
        perceivedValue: outcome.perceivedValue,
      }),
    };
  }

  if (outcome.verdict === 'MORAL_REFUSAL' && replayPly.forced === true) {
    const witnesses = roster.filter((piece) => piece.id !== actor.id);
    const override = applyOverride(actor, witnesses, ply, replayPly.san);
    const nextRoster = roster.map((piece) => {
      if (piece.id === actor.id) return override.overriddenPiece;
      const updated = override.witnesses.find((w) => w.id === piece.id);
      return updated ?? piece;
    });
    let nextEvents = appendEvent(events, override.event);
    for (const witnessEvent of override.witnessEvents) {
      nextEvents = appendEvent(nextEvents, witnessEvent);
    }
    if (override.shameEvent !== undefined) {
      nextEvents = appendEvent(nextEvents, override.shameEvent);
    }
    nextEvents = appendEvent(nextEvents, {
      t: 'MOVE',
      ply,
      san: replayPly.san,
      pieceId: actor.id,
      verdict: 'COMPLIANT_EXECUTION',
    });
    return { roster: nextRoster.map(normalizePieceState), events: nextEvents };
  }

  if (outcome.verdict === 'DESERTION_MUTINY') {
    const desertion =
      replayPly.desertionContext === undefined
        ? undefined
        : shouldDesert(actor, replayPly.desertionContext, roster);
    const cascade = applyDesertionWithCascade(
      roster,
      {
        actor,
        refusedMove: replayPly.moveEval.moveNotation,
        refusedMoveEval: replayPly.moveEval,
        moveEvalByPiece: { [actor.id]: replayPly.moveEval },
        uStay: desertion?.uStay ?? 0,
        uDesert: desertion?.uDesert ?? 0,
        ...(desertion?.terms === undefined ? {} : { terms: desertion.terms }),
      },
      ply,
    );
    let nextEvents = events;
    for (const event of cascade.events) {
      nextEvents = appendEvent(nextEvents, event);
    }
    return {
      roster: cascade.roster.map(normalizePieceState),
      events: nextEvents,
    };
  }

  const nextEvents = appendEvent(events, {
    t: 'MOVE',
    ply,
    san: replayPly.san,
    pieceId: actor.id,
    verdict: outcome.verdict,
  });
  return {
    roster: roster.map(normalizePieceState),
    events: nextEvents,
  };
}

/** Deterministic fold over frozen intents (Milestone 2.6). */
export function replayMatch(manifest: ReplayManifest): ReplayResult {
  const random = createSeededRandom(manifest.seed);
  let roster: PieceState[] = manifest.roster.map((piece) =>
    normalizePieceState({
      ...piece,
      credence: piece.credence ?? defaultCredence(),
      rumor: piece.rumor ?? defaultRumor(),
    }),
  );
  let events: readonly MatchEvent[] = [];
  let ply = 1;
  for (const replayPly of manifest.plies) {
    random.nextInt(1_000_000);
    const committed = commitPly(roster, events, ply, replayPly);
    roster = committed.roster;
    events = committed.events;
    ply += 1;
  }
  return { events, roster };
}

export function replayDigest(manifest: ReplayManifest): string {
  const result = replayMatch(manifest);
  return canonicalJson(result.events);
}
