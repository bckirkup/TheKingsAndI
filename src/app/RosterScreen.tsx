import { useState } from 'react';

import {
  activeLineup,
  applyBench,
  applyFire,
  applyRecruit,
  previewBench,
  previewFire,
} from '../orchestration/rosterActions';
import type { MatchEvent } from '../psychology';
import type {
  PieceIdentityRecord,
  PieceServiceRecord,
  StoredPieceState,
} from '../persistence';
import { trustBandWord, trustChangeWord } from '../ui/qualitativeLabels';

export interface RosterScreenProps {
  readonly roster: readonly StoredPieceState[];
  readonly freeAgents: readonly StoredPieceState[];
  readonly identities: readonly PieceIdentityRecord[];
  readonly serviceRecords: ReadonlyMap<string, PieceServiceRecord>;
  readonly leaderAbilityTrust: number;
  readonly onConfirm: (
    roster: StoredPieceState[],
    preambleEvents: MatchEvent[],
  ) => void;
  readonly onBack: () => void;
}

export function RosterScreen({
  roster,
  freeAgents,
  identities,
  serviceRecords,
  leaderAbilityTrust,
  onConfirm,
  onBack,
}: RosterScreenProps): JSX.Element {
  const [draft, setDraft] = useState<StoredPieceState[]>([...roster]);
  const [preambleEvents, setPreambleEvents] = useState<MatchEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [launderingWarning, setLaunderingWarning] = useState(false);
  const selected = draft.find((piece) => piece.id === selectedId);
  const identityById = new Map(
    identities.map((identity) => [identity.id, identity]),
  );
  const nameFor = (piece: StoredPieceState): string =>
    identityById.get(piece.id)?.name ?? `${piece.role} conscript`;
  const roleFor = (piece: StoredPieceState): string => {
    const originRole = identityById.get(piece.id)?.originRole;
    return originRole !== undefined && originRole !== piece.role
      ? `${piece.role} (promoted from ${originRole.toLowerCase()})`
      : piece.role;
  };

  return (
    <section className="roster-screen">
      <h1>Roster management</h1>
      <p>Bench, fire, or recruit free agents before the match.</p>

      {freeAgents.length > 0 ? (
        <div className="roster-screen__free-agents">
          <h2>Free agents</h2>
          <ul className="roster-screen__list">
            {freeAgents.map((agent) => (
              <li key={agent.id}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const result = applyRecruit({
                      freeAgent: agent,
                      roster: draft,
                      leaderAbilityTrust,
                    });
                    setDraft([...result.roster]);
                    setPreambleEvents([...preambleEvents, result.event]);
                    setLaunderingWarning(result.launderingRisk);
                  }}
                >
                  Recruit {nameFor(agent)} — {roleFor(agent)} (
                  {trustBandWord(agent.T_i)} trust)
                </button>
              </li>
            ))}
          </ul>
          {launderingWarning ? (
            <p className="roster-screen__warning">
              Roster laundering risk: high-trust recruits on a deep bench.
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="roster-screen__list">
        {draft.map((piece) => (
          <li key={piece.id}>
            <button
              type="button"
              className={`roster-screen__piece${selectedId === piece.id ? ' roster-screen__piece--selected' : ''}`}
              onClick={() => setSelectedId(piece.id)}
            >
              <strong>{nameFor(piece)}</strong> · {roleFor(piece)} ·{' '}
              {trustBandWord(piece.T_i)} trust · {piece.status}
            </button>
          </li>
        ))}
      </ul>

      {selected !== undefined ? (
        <div className="roster-screen__service">
          <h2>Service record — {nameFor(selected)}</h2>
          {(() => {
            const record = serviceRecords.get(selected.id);
            if (record === undefined) {
              return <p>No recorded service yet.</p>;
            }
            return (
              <dl>
                <dt>Matches served</dt>
                <dd>{record.matchesServed}</dd>
                <dt>Orders carried out</dt>
                <dd>{record.ordersCarriedOut}</dd>
                <dt>Orders refused</dt>
                <dd>{record.ordersRefused}</dd>
                <dt>Orders overridden</dt>
                <dd>{record.ordersOverridden}</dd>
                <dt>Captures made</dt>
                <dd>{record.capturesMade}</dd>
                <dt>Times taken</dt>
                <dd>{record.timesTaken}</dd>
                <dt>Comrades covered</dt>
                <dd>{record.timesCoveredComrade}</dd>
                <dt>Heroism nominations</dt>
                <dd>{record.heroismNominations}</dd>
                <dt>Benched</dt>
                <dd>{record.timesBenched}</dd>
                <dt>Fired</dt>
                <dd>{record.timesFired}</dd>
                <dt>Recruited</dt>
                <dd>{record.timesRecruited}</dd>
                <dt>Deserted</dt>
                <dd>{record.deserted ? 'Yes' : 'No'}</dd>
              </dl>
            );
          })()}
        </div>
      ) : null}

      {selected !== undefined && selected.status === 'ACTIVE' ? (
        <div className="roster-screen__preview">
          <h2>Consequence preview — {nameFor(selected)}</h2>
          {(() => {
            const bench = previewBench(selected, draft);
            const fire = previewFire(selected);
            return (
              <>
                <p>
                  Bench: self trust impact{' '}
                  {trustChangeWord(bench.selfTrustDelta)}, peers affected{' '}
                  {bench.peerTrustDeltas.length}
                </p>
                <p>Fire: trust becomes {trustBandWord(fire.newTrust)} </p>
                <div className="roster-screen__actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const result = applyBench(selected, draft);
                      setDraft([...result.roster]);
                      setPreambleEvents([...preambleEvents, result.event]);
                    }}
                  >
                    Bench
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => {
                      const result = applyFire(selected, draft);
                      setDraft([...result.roster]);
                      setPreambleEvents([...preambleEvents, result.event]);
                    }}
                  >
                    Fire
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}

      <div className="campaign-hub__actions">
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onConfirm(draft, preambleEvents)}
          disabled={activeLineup(draft).length < 2}
        >
          Confirm lineup ({activeLineup(draft).length} active)
        </button>
      </div>
    </section>
  );
}
