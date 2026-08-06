import { useState } from 'react';

import {
  activeLineup,
  applyBench,
  applyFire,
  previewBench,
  previewFire,
} from '../orchestration/rosterActions';
import type { StoredPieceState } from '../persistence';

export interface RosterScreenProps {
  readonly roster: readonly StoredPieceState[];
  readonly onConfirm: (roster: StoredPieceState[]) => void;
  readonly onBack: () => void;
}

export function RosterScreen({
  roster,
  onConfirm,
  onBack,
}: RosterScreenProps): JSX.Element {
  const [draft, setDraft] = useState<StoredPieceState[]>([...roster]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = draft.find((piece) => piece.id === selectedId);

  return (
    <section className="roster-screen">
      <h1>Roster management</h1>
      <p>Bench or fire before the match. Consequences are previewed below.</p>
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
          onClick={() => onConfirm(draft)}
          disabled={activeLineup(draft).length < 2}
        >
          Confirm lineup ({activeLineup(draft).length} active)
        </button>
      </div>
    </section>
  );
}
