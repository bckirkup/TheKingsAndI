import type { PieceState } from '../../psychology';

export interface PieceOverlayProps {
  readonly piece: PieceState;
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
  const file = (square.codePointAt(0) ?? 0) - ('a'.codePointAt(0) ?? 0);
  const rank = Number.parseInt(square.charAt(1), 10);
  return { column: file + 1, row: 9 - rank };
}

export function PieceOverlay({
  piece,
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
      aria-label={`${piece.role} trust ${piece.T_i} morale ${piece.M_i}`}
      onClick={onSelect}
    >
      <span
        className="piece-overlay__aura"
        style={{
          boxShadow: `0 0 0 ${trustRing}px ${trustHue(piece.T_i)}`,
        }}
      />
      <span className="piece-overlay__morale" title={`Morale ${piece.M_i}`}>
        <span
          className="piece-overlay__morale-fill"
          style={{ height: `${moraleHeight}px` }}
        />
      </span>
      {betrayal ? (
        <span className="piece-overlay__betrayal" title={`Trauma ${piece.B_i}`}>
          !
        </span>
      ) : null}
    </button>
  );
}
