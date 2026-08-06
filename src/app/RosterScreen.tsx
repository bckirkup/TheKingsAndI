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
import type { StoredPieceState } from '../persistence';

export interface RosterScreenProps {
  readonly roster: readonly StoredPieceState[];
  readonly freeAgents: readonly StoredPieceState[];
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
  leaderAbilityTrust,
  onConfirm,
  onBack,
}: RosterScreenProps): JSX.Element {
  const [draft, setDraft] = useState<StoredPieceState[]>([...roster]);
  const [preambleEvents, setPreambleEvents] = useState<MatchEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [launderingWarning, setLaunderingWarning] = useState(false);
  const selected = draft.find((piece) => piece.id === selectedId);

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
                  Recruit {agent.role} (T={agent.T_i})
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
              <strong>{piece.role}</strong> · T={piece.T_i} · {piece.status}
            </button>
          </li>
        ))}
      </ul>

      {selected !== undefined && selected.status === 'ACTIVE' ? (
        <div className="roster-screen__preview">
          <h2>Consequence preview — {selected.role}</h2>
          {(() => {
            const bench = previewBench(selected, draft);
            const fire = previewFire(selected);
            return (
              <>
                <p>
                  Bench: self trust {bench.selfTrustDelta}, peers affected{' '}
                  {bench.peerTrustDeltas.length}
                </p>
                <p>Fire: trust set to {fire.newTrust}</p>
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
