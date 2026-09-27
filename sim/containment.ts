import type {
  DecisionKind,
  JournalEntry,
  Option,
} from '../src/orchestration/journal';

/**
 * The containment envelope as a *computed* metric (ADR 0063 §3), read from
 * journaled entries alone — each entry carries the option indices some
 * scripted NPC style would have chosen (`envelope`), recorded at ask time.
 *
 * Distance: `0` in-envelope; `1` a neighbouring rung (adjacent index on the
 * graded override ladder, or a move of the same piece to a different target);
 * `2` beyond that (a menu gap or an alien choice). A disengage pick no style
 * would make is the sharpest signal (`uncoveredDisengage`).
 */

export interface ContainmentKindMetrics {
  readonly decisions: number;
  readonly scored: number;
  readonly outOfEnvelope: number;
  readonly outOfEnvelopeRate: number;
  readonly distanceCounts: readonly [number, number, number];
  readonly distance2Count: number;
  readonly uncoveredDisengage: number;
}

export interface ContainmentReport {
  readonly decisionCount: number;
  readonly scoredDecisions: number;
  readonly perKind: Readonly<Record<DecisionKind, ContainmentKindMetrics>>;
  readonly uncoveredDisengageCount: number;
  readonly firstUncoveredDisengageIndex: number | undefined;
}

function optionDistance(
  kind: DecisionKind,
  options: readonly Option[],
  chosen: number,
  envelope: readonly number[],
): 0 | 1 | 2 {
  if (envelope.includes(chosen)) return 0;
  const picked = options[chosen];
  const enveloped = envelope
    .map((index) => options[index])
    .filter((option): option is Option => option !== undefined);
  const envelopedMoves = enveloped.filter(
    (option) => option.kind === 'move',
  );
  if (
    picked?.kind === 'move' &&
    picked.from !== undefined &&
    envelopedMoves.some((option) => option.from === picked.from)
  ) {
    return 1;
  }
  if (kind === 'override') {
    // The override ask is a graded three-rung ladder (override, stand,
    // disengage): adjacency in index order is a neighbouring bid.
    const minIndexDistance = Math.min(
      ...envelope.map((index) => Math.abs(index - chosen)),
    );
    if (minIndexDistance === 1) return 1;
  }
  return 2;
}

export function containmentReport(
  entries: readonly JournalEntry[],
): ContainmentReport {
  const perKind = new Map<
    DecisionKind,
    {
      decisions: number;
      scored: number;
      outOfEnvelope: number;
      distanceCounts: [number, number, number];
      uncoveredDisengage: number;
    }
  >();
  let scoredDecisions = 0;
  let uncoveredDisengageCount = 0;
  let firstUncoveredDisengageIndex: number | undefined;
  for (const entry of entries) {
    const bucket = perKind.get(entry.at.kind) ?? {
      decisions: 0,
      scored: 0,
      outOfEnvelope: 0,
      distanceCounts: [0, 0, 0],
      uncoveredDisengage: 0,
    };
    bucket.decisions += 1;
    perKind.set(entry.at.kind, bucket);
    if (entry.envelope === undefined || entry.chosen < 0) continue;
    bucket.scored += 1;
    scoredDecisions += 1;
    const distance = optionDistance(
      entry.at.kind,
      entry.options,
      entry.chosen,
      entry.envelope,
    );
    bucket.distanceCounts[distance] += 1;
    if (distance > 0) bucket.outOfEnvelope += 1;
    const picked = entry.options[entry.chosen];
    if (picked?.kind === 'disengage' && !entry.envelope.includes(entry.chosen)) {
      bucket.uncoveredDisengage += 1;
      uncoveredDisengageCount += 1;
      firstUncoveredDisengageIndex ??= entry.decisionIndex;
    }
  }
  const kinds: DecisionKind[] = ['move', 'override'];
  const record: Partial<Record<DecisionKind, ContainmentKindMetrics>> = {};
  for (const kind of kinds) {
    const bucket = perKind.get(kind);
    if (bucket === undefined) {
      record[kind] = {
        decisions: 0,
        scored: 0,
        outOfEnvelope: 0,
        outOfEnvelopeRate: 0,
        distanceCounts: [0, 0, 0],
        distance2Count: 0,
        uncoveredDisengage: 0,
      };
      continue;
    }
    record[kind] = {
      decisions: bucket.decisions,
      scored: bucket.scored,
      outOfEnvelope: bucket.outOfEnvelope,
      outOfEnvelopeRate:
        bucket.scored === 0 ? 0 : bucket.outOfEnvelope / bucket.scored,
      distanceCounts: bucket.distanceCounts,
      distance2Count: bucket.distanceCounts[2],
      uncoveredDisengage: bucket.uncoveredDisengage,
    };
  }
  return {
    decisionCount: entries.length,
    scoredDecisions,
    perKind: record as Record<DecisionKind, ContainmentKindMetrics>,
    uncoveredDisengageCount,
    firstUncoveredDisengageIndex,
  };
}
