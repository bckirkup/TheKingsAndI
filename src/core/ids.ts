/**
 * Identity types shared by every layer. They live in `core/` because `engine/`
 * is below `chess/` and may not import it (AGENTS.md rule 4), yet both must
 * agree on what a piece is called: the query barrier orders results by
 * `PieceId` (ADR 0034).
 */

/** Stable for the piece's whole life; minted by the roster layer. */
export type PieceId = string;

/** Total order on identities. The barrier's canonical ordering depends on it. */
export function comparePieceIds(left: PieceId, right: PieceId): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
