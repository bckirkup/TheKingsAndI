/**
 * Consumer pacing profile (ADR 0027 §4 / 5.8i).
 * Something legible about the leadership mechanic must occur inside Steam's
 * ninety-minute refund window.
 */
export const PACING_CONFIG = {
  /** Consumer refund window in minutes. */
  CONSUMER_WINDOW_MINUTES: 90,
  /** Estimated wall minutes per match under the consumer profile. */
  MINUTES_PER_MATCH: 12,
  /** Match index (1-based) by which a refusal or override must have occurred. */
  FIRST_LEADERSHIP_BEAT_MATCH: 2,
  /** Match index by which a trust delta or desertion signal must appear. */
  SECOND_LEADERSHIP_BEAT_MATCH: 4,
  /** Match index by which an audit column gap must be visible. */
  THIRD_LEADERSHIP_BEAT_MATCH: 6,
} as const;

export type PacingConfig = typeof PACING_CONFIG;

export type LeadershipBeatId =
  | 'first_refusal_or_override'
  | 'trust_or_desertion_signal'
  | 'quality_fidelity_gap';

export interface LeadershipBeat {
  readonly id: LeadershipBeatId;
  /** Latest 1-based match index by which this beat must fire. */
  readonly byMatchIndex: number;
  readonly description: string;
}

export function consumerLeadershipBeats(): readonly LeadershipBeat[] {
  return [
    {
      id: 'first_refusal_or_override',
      byMatchIndex: PACING_CONFIG.FIRST_LEADERSHIP_BEAT_MATCH,
      description: 'A refusal or override occurs — leadership is not pure chess.',
    },
    {
      id: 'trust_or_desertion_signal',
      byMatchIndex: PACING_CONFIG.SECOND_LEADERSHIP_BEAT_MATCH,
      description: 'Trust moves or a desertion is threatened or realized.',
    },
    {
      id: 'quality_fidelity_gap',
      byMatchIndex: PACING_CONFIG.THIRD_LEADERSHIP_BEAT_MATCH,
      description: 'Board quality and execution fidelity diverge in the audit.',
    },
  ];
}

export function matchesInsideConsumerWindow(): number {
  return Math.floor(
    PACING_CONFIG.CONSUMER_WINDOW_MINUTES / PACING_CONFIG.MINUTES_PER_MATCH,
  );
}

export interface PacingBeatObservation {
  readonly id: LeadershipBeatId;
  readonly requiredByMatch: number;
  readonly observedAtMatch: number | null;
  readonly satisfied: boolean;
}

export interface PacingProfileResult {
  readonly windowMatches: number;
  readonly beats: readonly PacingBeatObservation[];
  readonly cliff: boolean;
}

/** Pure check over match audits/events — used by harness and tests. */
export function evaluateConsumerPacing(
  matches: readonly {
    readonly matchIndex: number;
    readonly audit: {
      readonly refusalCount: number;
      readonly overrideCount: number;
      readonly desertionCount: number;
      readonly meanTrustDelta: number;
      readonly boardQuality: number;
      readonly executionFidelity: number;
    };
  }[],
): PacingProfileResult {
  const windowMatches = matchesInsideConsumerWindow();
  const inWindow = matches.filter(
    (match) => match.matchIndex <= windowMatches,
  );

  const firstSignal = inWindow.find(
    (match) =>
      match.audit.refusalCount > 0 || match.audit.overrideCount > 0,
  );
  const trustSignal = inWindow.find(
    (match) =>
      match.audit.desertionCount > 0 ||
      Math.abs(match.audit.meanTrustDelta) > 0,
  );
  const gapSignal = inWindow.find((match) => {
    const gap = match.audit.boardQuality - match.audit.executionFidelity * 100;
    return Math.abs(gap) >= 10;
  });

  const beats: PacingBeatObservation[] = consumerLeadershipBeats().map(
    (beat) => {
      const observed =
        beat.id === 'first_refusal_or_override'
          ? (firstSignal?.matchIndex ?? null)
          : beat.id === 'trust_or_desertion_signal'
            ? (trustSignal?.matchIndex ?? null)
            : (gapSignal?.matchIndex ?? null);
      const satisfied =
        observed !== null && observed <= beat.byMatchIndex;
      return {
        id: beat.id,
        requiredByMatch: beat.byMatchIndex,
        observedAtMatch: observed,
        satisfied,
      };
    },
  );

  return {
    windowMatches,
    beats,
    cliff: beats.some((beat) => !beat.satisfied),
  };
}
