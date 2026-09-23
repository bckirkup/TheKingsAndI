import type { ObservationPiece } from '../../orchestration/observation';
import type { HeatBandWord } from '../qualitativeLabels';

export interface RelationshipInspectorProps {
  readonly roster: readonly ObservationPiece[];
  readonly selectedPieceId: string | null;
}

function heatClass(heat: HeatBandWord): string {
  if (heat === 'cold') return 'heat--cold';
  if (heat === 'warm') return 'heat--hot';
  return 'heat--neutral';
}

function peerLabel(
  roster: readonly ObservationPiece[],
  peerId: string,
): string {
  return roster.find((piece) => piece.id === peerId)?.role ?? peerId;
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
        Focus: <strong>{selected.role}</strong> ({selected.trust} trust,{' '}
        {selected.morale} morale)
      </p>

      <h3>Who protects whom</h3>
      <ul className="relationship-inspector__affinity">
        {selected.affinities.map((edge) => (
          <li key={edge.peerId}>
            <span>{peerLabel(roster, edge.peerId)}</span>
            <span className={heatClass(edge.heat)}>{edge.heat}</span>
          </li>
        ))}
      </ul>

      <h3>Class prejudice heatmap</h3>
      <table className="relationship-inspector__matrix">
        <thead>
          <tr>
            <th />
            {selected.classHeat.map((cell) => (
              <th key={cell.role}>{cell.role.slice(0, 1)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>{selected.role}</th>
            {selected.classHeat.map((cell) => (
              <td key={cell.role} className={heatClass(cell.heat)}>
                {cell.heat}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}
