import type { MatchRecord } from '../../persistence';

export interface DebriefBarChartProps {
  readonly matches: readonly MatchRecord[];
}

export function DebriefBarChart({
  matches,
}: DebriefBarChartProps): JSX.Element {
  const maxQuality = Math.max(
    100,
    ...matches.map((match) => match.audit.boardQuality),
  );

  return (
    <div className="debrief-chart">
      <h2>Board quality vs execution fidelity</h2>
      <ul className="debrief-chart__bars">
        {matches.map((match) => (
          <li key={match.id} className="debrief-chart__row">
            <span className="debrief-chart__label">M{match.matchIndex}</span>
            <div className="debrief-chart__track">
              <div
                className="debrief-chart__bar debrief-chart__bar--quality"
                style={{
                  width: `${(match.audit.boardQuality / maxQuality) * 100}%`,
                }}
                title={`Board quality ${match.audit.boardQuality.toFixed(1)}`}
              />
              <div
                className="debrief-chart__bar debrief-chart__bar--fidelity"
                style={{
                  width: `${match.audit.executionFidelity * 100}%`,
                }}
                title={`Execution fidelity ${(match.audit.executionFidelity * 100).toFixed(0)}%`}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="debrief-chart__legend">
        <span className="debrief-chart__swatch debrief-chart__swatch--quality" />{' '}
        Board quality
        <span className="debrief-chart__swatch debrief-chart__swatch--fidelity" />{' '}
        Execution fidelity
      </p>
    </div>
  );
}
