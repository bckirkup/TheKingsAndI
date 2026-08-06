import { matchAuditProse, type NarratedOutcome } from '../narrative';
import type { MatchRecord, MatchResult } from '../persistence';
import type { PieceRole } from '../psychology';

export interface MatchAuditScreenProps {
  readonly match: MatchRecord;
  readonly onContinue: () => void;
}

const OUTCOME_BY_RESULT: Readonly<Record<MatchResult, NarratedOutcome>> = {
  WIN: 'WIN',
  LOSS: 'LOSS',
  DRAW: 'DRAW',
  ROUT: 'ROUT',
  DISMISSED: 'DISMISSED',
  ABANDONED: 'ABANDONED',
};

export function MatchAuditScreen({
  match,
  onContinue,
}: MatchAuditScreenProps): JSX.Element {
  const gap = match.audit.boardQuality - match.audit.executionFidelity * 100;

  const roleOf: Record<string, PieceRole> = {};
  for (const piece of match.rosterSnapshot) roleOf[piece.id] = piece.role;
  const prose = matchAuditProse({
    result: OUTCOME_BY_RESULT[match.result],
    boardQuality: match.audit.boardQuality,
    executionFidelity: match.audit.executionFidelity,
    overrideCount: match.audit.overrideCount,
    desertionCount: match.audit.desertionCount,
    refusalCount: match.audit.refusalCount,
    events: match.events,
    roleOf,
  });

  return (
    <section className="match-audit-screen">
      <h1>Match {match.matchIndex} audit</h1>
      <p className="match-audit-screen__result">Result: {match.result}</p>

      <div className="narration-audit">
        <h2 className="narration-audit__headline">{prose.headline}</h2>
        {prose.paragraphs.map((paragraph) => (
          <p key={paragraph} className="narration-audit__paragraph">
            {paragraph}
          </p>
        ))}
        <ul className="narration-audit__findings">
          {prose.findings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      </div>

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
