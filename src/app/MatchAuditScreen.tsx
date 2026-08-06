import type { MatchRecord } from '../persistence';

export interface MatchAuditScreenProps {
  readonly match: MatchRecord;
  readonly onContinue: () => void;
}

export function MatchAuditScreen({
  match,
  onContinue,
}: MatchAuditScreenProps): JSX.Element {
  const gap = match.audit.boardQuality - match.audit.executionFidelity * 100;

  return (
    <section className="match-audit-screen">
      <h1>Match {match.matchIndex} audit</h1>
      <p className="match-audit-screen__result">Result: {match.result}</p>

      <table className="debrief-screen__table">
        <tbody>
          <tr>
            <th>Board quality</th>
            <td>{match.audit.boardQuality.toFixed(1)} cp</td>
          </tr>
          <tr>
            <th>Execution fidelity</th>
            <td>{(match.audit.executionFidelity * 100).toFixed(0)}%</td>
          </tr>
          <tr>
            <th>Gap (diagnosis)</th>
            <td>{gap.toFixed(1)}</td>
          </tr>
          <tr>
            <th>Refusals</th>
            <td>{match.audit.refusalCount}</td>
          </tr>
          <tr>
            <th>Overrides</th>
            <td>{match.audit.overrideCount}</td>
          </tr>
          <tr>
            <th>Desertions</th>
            <td>{match.audit.desertionCount}</td>
          </tr>
          <tr>
            <th>Quiet quits</th>
            <td>{match.audit.quietQuitCount}</td>
          </tr>
          <tr>
            <th>Trust delta</th>
            <td>{match.audit.meanTrustDelta.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>

      <button type="button" className="btn" onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}
