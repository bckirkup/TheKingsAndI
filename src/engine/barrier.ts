import { digest } from '../core/digest';
import { comparePieceIds } from '../core/ids';
import { requestKey, type EvaluationCache } from './cache';
import type {
  EngineEvaluation,
  EnginePort,
  Insight,
  InsightBundle,
  InsightFailure,
  InsightRequest,
} from './types';

/**
 * The per-ply query barrier (ADR 0034 §1).
 *
 * Every query in a round is issued, then awaited to completion, then sorted by
 * `PieceId`, then frozen. Only after that may psychology run — and psychology is
 * synchronous, so a reducer cannot await, and a reducer that cannot await cannot
 * observe which query returned first.
 *
 * Nothing here may race, time out, or short-circuit; `Promise.race`,
 * `Promise.any`, `setTimeout`, and `Date.now` are lint errors in this layer.
 */

export interface BarrierOptions {
  /** 0-based round index. A dependent query opens the next one (§3). */
  readonly round?: number;
  readonly cache?: EvaluationCache;
}

/** Thrown when a round the caller required to be complete was not (§5). */
export class InsightRoundFailedError extends Error {
  readonly failures: readonly InsightFailure[];

  constructor(bundle: InsightBundle) {
    const named = bundle.failures
      .map((failure) => `${failure.pieceId}: ${failure.reason}`)
      .join('; ');
    super(`Insight round ${bundle.round} failed for ${named}`);
    this.name = 'InsightRoundFailedError';
    this.failures = bundle.failures;
  }
}

function reasonOf(cause: unknown): string {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  return `NonError: ${String(cause)}`;
}

function validateEvaluation(
  request: InsightRequest,
  evaluation: EngineEvaluation,
): void {
  if (!Number.isSafeInteger(evaluation.scoreCp)) {
    throw new TypeError(
      `Engine returned a non-integer score for ${request.pieceId}; centipawns must be integers.`,
    );
  }
}

type Settled =
  | { readonly kind: 'insight'; readonly insight: Insight }
  | { readonly kind: 'failure'; readonly failure: InsightFailure };

async function resolveOne(
  port: EnginePort,
  request: InsightRequest,
  cache: EvaluationCache | undefined,
): Promise<Settled> {
  try {
    const key = requestKey(port.determinismId, request);
    const cached = cache?.get(key);
    let evaluation: EngineEvaluation;
    if (cached === undefined) {
      const fresh = await port.evaluate(request.fen, request.depth);
      validateEvaluation(request, fresh);
      evaluation =
        cache === undefined
          ? Object.freeze({
              scoreCp: fresh.scoreCp,
              pv: Object.freeze([...fresh.pv]),
            })
          : cache.set(key, fresh);
    } else {
      evaluation = cached;
    }
    return {
      kind: 'insight',
      insight: Object.freeze({
        pieceId: request.pieceId,
        depth: request.depth,
        scoreCp: evaluation.scoreCp,
        pv: evaluation.pv,
      }),
    };
  } catch (cause) {
    return {
      kind: 'failure',
      failure: Object.freeze({
        pieceId: request.pieceId,
        depth: request.depth,
        reason: reasonOf(cause),
      }),
    };
  }
}

/**
 * Issue the whole round, await all of it, and return a frozen ordered bundle.
 * A failed query becomes an ordered `InsightFailure`; the bundle is never
 * returned with a piece silently missing.
 */
export async function resolveInsightRound(
  port: EnginePort,
  requests: readonly InsightRequest[],
  options: BarrierOptions = {},
): Promise<InsightBundle> {
  const round = options.round ?? 0;
  // Promise.all, deliberately: the barrier waits for the slowest query rather
  // than proceeding on the first result back (§4).
  const settled = await Promise.all(
    requests.map((request) => resolveOne(port, request, options.cache)),
  );

  const insights: Insight[] = [];
  const failures: InsightFailure[] = [];
  for (const result of settled) {
    if (result.kind === 'insight') insights.push(result.insight);
    else failures.push(result.failure);
  }
  insights.sort((left, right) => comparePieceIds(left.pieceId, right.pieceId));
  failures.sort((left, right) => comparePieceIds(left.pieceId, right.pieceId));

  const body = {
    round,
    determinismId: port.determinismId,
    insights: insights.map((insight) => ({
      pieceId: insight.pieceId,
      depth: insight.depth,
      scoreCp: insight.scoreCp,
      pv: [...insight.pv],
    })),
    failures: failures.map((failure) => ({
      pieceId: failure.pieceId,
      depth: failure.depth,
      reason: failure.reason,
    })),
  };

  return Object.freeze({
    round,
    determinismId: port.determinismId,
    digest: digest(body),
    insights: Object.freeze(insights),
    failures: Object.freeze(failures),
  });
}

/**
 * The ply-abort gate (§5). Fifteen pieces must not decide without the
 * sixteenth, so the caller either has every insight or abandons the ply — and
 * an abandoned ply emits no events, so it cannot diverge on replay.
 */
export function requireComplete(bundle: InsightBundle): InsightBundle {
  if (bundle.failures.length > 0) throw new InsightRoundFailedError(bundle);
  return bundle;
}

/** Lookup by identity, for callers iterating their roster in `PieceId` order. */
export function insightOf(
  bundle: InsightBundle,
  pieceId: string,
): Insight | undefined {
  return bundle.insights.find((insight) => insight.pieceId === pieceId);
}
