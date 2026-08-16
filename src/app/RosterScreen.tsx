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
import {
  firePreviewLabel,
  freeAgentRecruitLabel,
  promotionAttainmentLabel,
  rosterPieceLabel,
  trustChangeWord,
} from '../ui/qualitativeLabels';

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
  const serviceLines = (record: PieceServiceRecord): readonly string[] => {
    const lines: string[] = [];
    if (record.ordersCarriedOut > 0) {
      lines.push(`Orders carried out: ${record.ordersCarriedOut}`);
    }
    if (record.ordersFatalistic > 0) {
      lines.push(`Fatalistic orders: ${record.ordersFatalistic}`);
    }
    if (record.ordersQuietlyQuit > 0) {
      lines.push(`Orders quietly quit: ${record.ordersQuietlyQuit}`);
    }
    if (record.ordersRefused > 0) {
      lines.push(`Orders refused: ${record.ordersRefused}`);
    }
    if (record.ordersOverridden > 0) {
      lines.push(`Orders overridden: ${record.ordersOverridden}`);
    }
    if (record.capturesMade > 0) {
      lines.push(`Captures made: ${record.capturesMade}`);
    }
    if (record.timesTaken > 0) {
      lines.push(`Times taken: ${record.timesTaken}`);
    }
    if (record.timesCoveredComrade > 0) {
      lines.push(`Comrades covered: ${record.timesCoveredComrade}`);
    }
    if (record.heroismNominations > 0) {
      lines.push(`Heroism nominations: ${record.heroismNominations}`);
    }
    if (record.timesBenched > 0) {
      lines.push(`Benched: ${record.timesBenched}`);
    }
    if (record.timesFired > 0) {
      lines.push(`Fired: ${record.timesFired}`);
    }
    if (record.timesRecruited > 0) {
      lines.push(`Recruited: ${record.timesRecruited}`);
    }
    if (record.promotions > 0) {
      lines.push(`Promotions: ${record.promotions}`);
    }
    if (record.deserted) lines.push('Deserted');
    return lines;
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
                  {freeAgentRecruitLabel(
                    nameFor(agent),
                    roleFor(agent),
                    agent.T_i,
                  )}
                  {promotionAttainmentLabel(
                    identityById.get(agent.id)?.attainedRole,
                  ) ?? null}
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
              {rosterPieceLabel(
                nameFor(piece),
                roleFor(piece),
                piece.T_i,
                piece.status,
              )}
              {promotionAttainmentLabel(
                identityById.get(piece.id)?.attainedRole,
              ) ?? null}
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
            const lines = serviceLines(record);
            return (
              <>
                <p>Matches served: {record.matchesServed}</p>
                {lines.length === 0 ? (
                  <p>No recorded deeds yet.</p>
                ) : (
                  <ul>
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </>
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
                <p>{firePreviewLabel(fire.newTrust)}</p>
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
