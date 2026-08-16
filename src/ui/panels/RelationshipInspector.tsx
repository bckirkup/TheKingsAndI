import type { PieceState } from '../../psychology';
import {
  heatBandWord,
  moraleBandWord,
  trustBandWord,
} from '../qualitativeLabels';

const ROLES = ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'] as const;

export interface RelationshipInspectorProps {
  readonly roster: readonly PieceState[];
  readonly selectedPieceId: string | null;
}

function heatClass(value: number): string {
  if (value <= -20) return 'heat--cold';
  if (value >= 20) return 'heat--hot';
  return 'heat--neutral';
}

export function RelationshipInspector({
  roster,
  selectedPieceId,
}: RelationshipInspectorProps): JSX.Element {
  const selected =
    roster.find((piece) => piece.id === selectedPieceId) ?? roster[0];

  if (selected === undefined) {
    return (
      <section className="relationship-inspector">
        <h2>Relationships</h2>
        <p>No roster remaining.</p>
      </section>
    );
  }

  return (
    <section className="relationship-inspector">
      <h2>Relationships</h2>
      <p className="relationship-inspector__focus">
        Focus: <strong>{selected.role}</strong> ({trustBandWord(selected.T_i)}{' '}
        trust, {moraleBandWord(selected.M_i)} morale)
      </p>

      <h3>Who protects whom</h3>
      <ul className="relationship-inspector__affinity">
        {roster
          .filter((peer) => peer.id !== selected.id)
          .map((peer) => {
            const affinity = selected.dyadicAffinity[peer.id] ?? 0;
            return (
              <li key={peer.id}>
                <span>{peer.role}</span>
                <span className={heatClass(affinity)}>
                  {heatBandWord(affinity)}
                </span>
              </li>
            );
          })}
      </ul>

      <h3>Class prejudice heatmap</h3>
      <table className="relationship-inspector__matrix">
        <thead>
          <tr>
            <th />
            {ROLES.map((role) => (
              <th key={role}>{role.slice(0, 1)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>{selected.role}</th>
            {ROLES.map((role) => {
              const value = selected.classPrestige[role];
              return (
                <td key={role} className={heatClass(value)}>
                  {heatBandWord(value)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </section>
  );
}
