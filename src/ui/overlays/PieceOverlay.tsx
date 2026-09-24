import type { ObservationPiece } from '../../orchestration/observation';
import type { MoraleBandWord, TrustBandWord } from '../qualitativeLabels';
import {
  moraleTooltip,
  pieceAccessibleLabel,
  traumaTooltip,
} from '../qualitativeLabels';

export interface PieceOverlayProps {
  readonly piece: ObservationPiece;
  readonly name?: string;
  readonly square: string;
  readonly selected: boolean;
  readonly onSelect?: () => void;
}

const TRUST_RING_PX: Record<TrustBandWord, number> = {
  hostile: 2,
  wary: 4,
  loyal: 6,
};

const TRUST_HUE: Record<TrustBandWord, string> = {
  hostile: 'var(--trust-hostile)',
  wary: 'var(--trust-wary)',
  loyal: 'var(--trust-loyal)',
};

const MORALE_HEIGHT_PX: Record<MoraleBandWord, number> = {
  low: 8,
  steady: 16,
  strong: 24,
};

export function squareGridPosition(square: string): {
  column: number;
  row: number;
} {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number.parseInt(square.charAt(1), 10);
  return { column: file + 1, row: 9 - rank };
}

/**
 * Aura / morale chrome over a square. The overlay shell is pointer-events
 * none so chessground receives drag-to-move; only the corner select chip
 * captures clicks for the relationship inspector (UI plan S1 / S2a).
 */
export function PieceOverlay({
  piece,
  name,
  square,
  selected,
  onSelect,
}: PieceOverlayProps): JSX.Element {
  const trustRing = TRUST_RING_PX[piece.trust];
  const moraleHeight = MORALE_HEIGHT_PX[piece.morale];
  const betrayal = piece.trauma !== 'clear';
  const { column, row } = squareGridPosition(square);
  const label = pieceAccessibleLabel(
    name,
    piece.role,
    piece.trust,
    piece.morale,
  );

  return (
    <div
      className={`piece-overlay${selected ? ' piece-overlay--selected' : ''}`}
      style={{ gridColumn: column, gridRow: row }}
      data-square={square}
    >
      <span
        className="piece-overlay__aura"
        style={{
          boxShadow: `0 0 0 ${trustRing}px ${TRUST_HUE[piece.trust]}`,
        }}
        aria-hidden="true"
      />
      <span
        className="piece-overlay__morale"
        title={moraleTooltip(piece.morale)}
        aria-hidden="true"
      >
        <span
          className="piece-overlay__morale-fill"
          style={{ height: `${moraleHeight}px` }}
        />
      </span>
      {betrayal ? (
        <span
          className="piece-overlay__betrayal"
          title={traumaTooltip(piece.trauma)}
          aria-hidden="true"
        >
          !
        </span>
      ) : null}
      <button
        type="button"
        className="piece-overlay__select"
        aria-label={label}
        aria-pressed={selected}
        onClick={onSelect}
      />
    </div>
  );
}
