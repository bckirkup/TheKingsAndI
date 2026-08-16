import type { PieceState } from '../../psychology';
import {
  moraleTooltip,
  pieceAccessibleLabel,
  traumaTooltip,
} from '../qualitativeLabels';

export interface PieceOverlayProps {
  readonly piece: PieceState;
  readonly name?: string;
  readonly square: string;
  readonly selected: boolean;
  readonly onSelect?: () => void;
}

function trustHue(trust: number): string {
  if (trust < 0) return 'var(--trust-hostile)';
  if (trust < 40) return 'var(--trust-wary)';
  return 'var(--trust-loyal)';
}

function squareGridPosition(square: string): { column: number; row: number } {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number.parseInt(square.charAt(1), 10);
  return { column: file + 1, row: 9 - rank };
}

export function PieceOverlay({
  piece,
  name,
  square,
  selected,
  onSelect,
}: PieceOverlayProps): JSX.Element {
  const trustRing = Math.max(
    2,
    Math.min(6, Math.round((piece.T_i + 100) / 40)),
  );
  const moraleHeight = Math.max(4, Math.round((piece.M_i / 100) * 24));
  const betrayal = piece.B_i >= 40;
  const { column, row } = squareGridPosition(square);

  return (
    <button
      type="button"
      className={`piece-overlay${selected ? ' piece-overlay--selected' : ''}`}
      style={{ gridColumn: column, gridRow: row }}
      aria-label={pieceAccessibleLabel(name, piece.role, piece.T_i, piece.M_i)}
      onClick={onSelect}
    >
      <span
        className="piece-overlay__aura"
        style={{
          boxShadow: `0 0 0 ${trustRing}px ${trustHue(piece.T_i)}`,
        }}
      />
      <span className="piece-overlay__morale" title={moraleTooltip(piece.M_i)}>
        <span
          className="piece-overlay__morale-fill"
          style={{ height: `${moraleHeight}px` }}
        />
      </span>
      {betrayal ? (
        <span
          className="piece-overlay__betrayal"
          title={traumaTooltip(piece.B_i)}
        >
          !
        </span>
      ) : null}
    </button>
  );
}
