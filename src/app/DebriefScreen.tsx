import { useEffect, useState } from 'react';

import { CareerRepository } from '../persistence';
import type { CampaignDebrief } from '../persistence';
import { EPILOGUE_STUB } from '../orchestration/terminalState';

export interface DebriefScreenProps {
  readonly campaignId: string;
  readonly onBack: () => void;
}

export function DebriefScreen({
  campaignId,
  onBack,
}: DebriefScreenProps): JSX.Element {
  const [debrief, setDebrief] = useState<CampaignDebrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repo = new CareerRepository();
    void (async () => {
      await repo.init();
      try {
        setDebrief(await repo.buildDebrief(campaignId));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Debrief failed.');
      }
    })();
  }, [campaignId]);

  if (error !== null) return <p>{error}</p>;
  if (debrief === null) return <p>Computing debrief…</p>;

  return (
    <section className="debrief-screen">
      <h1>Campaign debrief</h1>
      <p>{EPILOGUE_STUB.ongoing}</p>

      <table className="debrief-screen__table">
        <thead>
          <tr>
            <th>Match</th>
            <th>Board quality</th>
            <th>Execution fidelity</th>
            <th>Gap</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {debrief.matches.map((match) => (
            <tr key={match.id}>
              <td>{match.matchIndex}</td>
              <td>{match.audit.boardQuality.toFixed(1)}</td>
              <td>{(match.audit.executionFidelity * 100).toFixed(0)}%</td>
              <td>
                {(
                  match.audit.boardQuality -
                  match.audit.executionFidelity * 100
                ).toFixed(1)}
              </td>
              <td>{match.result}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Campaign folds</h2>
      <dl className="debrief-screen__folds">
        <div>
          <dt>Mean board quality</dt>
          <dd>{debrief.meanBoardQuality.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Mean execution fidelity</dt>
          <dd>{(debrief.meanExecutionFidelity * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt>Trust delta (longitudinal)</dt>
          <dd>
            {debrief.cultureDrift.deltaAverageTrustLongitudinal.toFixed(1)}
          </dd>
        </div>
        <div>
          <dt>Cross-class prestige shift</dt>
          <dd>{debrief.cultureDrift.crossClassPrestigeShift.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Burnout index</dt>
          <dd>{debrief.cultureDrift.burnoutIndex.toFixed(1)}</dd>
        </div>
      </dl>

      <button type="button" className="btn" onClick={onBack}>
        Back to campaign
      </button>
    </section>
  );
}
