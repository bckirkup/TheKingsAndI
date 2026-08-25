import type { EnginePort } from '../src/engine/types';

export interface EngineCallCost {
  readonly evaluateCalls: number;
  readonly multiPvAtCalls: number;
  readonly multiPvAtMaxCalls: number;
  readonly bestAtCalls: number;
  readonly engineCalls: number;
  readonly depthHistogram: Readonly<Record<string, number>>;
}

export interface MatchCost extends EngineCallCost {
  readonly match: number;
  readonly wallClockMs: number;
  readonly restarts: number;
  /**
   * Process-cumulative RSS high-water mark observed through this match.
   * Monotonic across match records; intended for leak detection.
   */
  readonly peakRssBytes: number;
  /**
   * Process-cumulative resource RSS high-water mark observed through this
   * match. Monotonic across match records; intended for leak detection.
   */
  readonly resourceMaxRssBytes: number;
  readonly plies: number;
  readonly msPerPly: number;
  readonly engineCallsPerPly: number;
}

export interface CampaignCost extends EngineCallCost {
  readonly wallClockMs: number;
  readonly restarts: number;
  readonly peakRssBytes: number;
  readonly resourceMaxRssBytes: number;
  readonly matches: number;
  readonly plies: number;
  readonly msPerMatch: number;
  readonly msPerPly: number;
  readonly engineCallsPerPly: number;
  readonly matchCosts: readonly MatchCost[];
}

export interface ShardCost extends EngineCallCost {
  readonly wallClockMs: number;
  readonly restarts: number;
  readonly peakRssBytes: number;
  readonly resourceMaxRssBytes: number;
  readonly matches: number;
  readonly campaigns: number;
  readonly plies: number;
  readonly msPerMatch: number;
  readonly msPerPly: number;
  readonly engineCallsPerPly: number;
  readonly matchCosts: readonly MatchCost[];
  readonly campaignCosts: readonly {
    readonly campaignIndex: number;
    readonly campaignSeed: number;
    readonly cost: CampaignCost;
  }[];
}

interface MutableCalls {
  evaluateCalls: number;
  multiPvAtCalls: number;
  multiPvAtMaxCalls: number;
  bestAtCalls: number;
  depthHistogram: Map<string, number>;
}

function emptyCalls(): MutableCalls {
  return {
    evaluateCalls: 0,
    multiPvAtCalls: 0,
    multiPvAtMaxCalls: 0,
    bestAtCalls: 0,
    depthHistogram: new Map(),
  };
}

function callsSnapshot(calls: MutableCalls): EngineCallCost {
  const evaluateCalls = calls.evaluateCalls;
  const multiPvAtCalls = calls.multiPvAtCalls;
  const multiPvAtMaxCalls = calls.multiPvAtMaxCalls;
  const bestAtCalls = calls.bestAtCalls;
  return {
    evaluateCalls,
    multiPvAtCalls,
    multiPvAtMaxCalls,
    bestAtCalls,
    engineCalls:
      evaluateCalls + multiPvAtCalls + multiPvAtMaxCalls + bestAtCalls,
    depthHistogram: Object.fromEntries(
      [...calls.depthHistogram.entries()]
        .sort(([left], [right]) => {
          const leftDepth = Number(left);
          const rightDepth = Number(right);
          const leftIsNumeric = Number.isSafeInteger(leftDepth);
          const rightIsNumeric = Number.isSafeInteger(rightDepth);
          if (leftIsNumeric && rightIsNumeric) return leftDepth - rightDepth;
          if (leftIsNumeric) return -1;
          if (rightIsNumeric) return 1;
          return left.localeCompare(right);
        })
        .map(([depth, count]) => [depth, count]),
    ),
  };
}

function sampleRss(): { readonly rss: number; readonly maxRss: number } {
  return {
    rss: process.memoryUsage().rss,
    maxRss: process.resourceUsage().maxRSS * 1024,
  };
}

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

export class CostTracker {
  private readonly startedAt = process.hrtime.bigint();
  private readonly startedRestarts: number;
  private calls = emptyCalls();
  private peakRssBytes = 0;
  private resourceMaxRssBytes = 0;
  private matchStart: bigint | undefined;
  private matchCalls = emptyCalls();
  private matchStartRestarts = 0;
  private matchStartRss = 0;
  private matchStartMaxRss = 0;
  private readonly matchCosts: MatchCost[] = [];

  constructor(private readonly engine: EnginePort) {
    this.startedRestarts = engine.getCostStats?.().restarts ?? 0;
    this.sample();
  }

  startMatch(): void {
    this.matchStart = process.hrtime.bigint();
    this.matchCalls = emptyCalls();
    this.matchStartRestarts = this.restarts();
    this.sample();
    this.matchStartRss = this.peakRssBytes;
    this.matchStartMaxRss = this.resourceMaxRssBytes;
  }

  endMatch(match: number, plies: number): void {
    if (this.matchStart === undefined) {
      throw new Error('CostTracker match was not started.');
    }
    this.sample();
    const calls = callsSnapshot(this.matchCalls);
    const wallClockMs = elapsedMs(this.matchStart);
    const safePlies = Math.max(1, plies);
    this.matchCosts.push({
      match,
      ...calls,
      wallClockMs,
      restarts: this.restarts() - this.matchStartRestarts,
      peakRssBytes: Math.max(this.matchStartRss, this.peakRssBytes),
      resourceMaxRssBytes: Math.max(
        this.matchStartMaxRss,
        this.resourceMaxRssBytes,
      ),
      plies,
      msPerPly: wallClockMs / safePlies,
      engineCallsPerPly: calls.engineCalls / safePlies,
    });
    this.matchStart = undefined;
  }

  recordEvaluate(depth: number): void {
    this.record(this.calls, 'evaluateCalls', depth);
    this.record(this.matchCalls, 'evaluateCalls', depth);
  }

  recordMultiPvAt(depth: number): void {
    this.record(this.calls, 'multiPvAtCalls', depth);
    this.record(this.matchCalls, 'multiPvAtCalls', depth);
  }

  recordMultiPvAtMax(): void {
    this.record(this.calls, 'multiPvAtMaxCalls', 'max');
    this.record(this.matchCalls, 'multiPvAtMaxCalls', 'max');
  }

  recordBestAt(depth: number): void {
    this.record(this.calls, 'bestAtCalls', depth);
    this.record(this.matchCalls, 'bestAtCalls', depth);
  }

  finish(): CampaignCost {
    this.sample();
    const calls = callsSnapshot(this.calls);
    const matches = this.matchCosts.length;
    const plies = this.matchCosts.reduce((sum, cost) => sum + cost.plies, 0);
    const wallClockMs = elapsedMs(this.startedAt);
    return {
      ...calls,
      wallClockMs,
      restarts: this.restarts() - this.startedRestarts,
      peakRssBytes: this.peakRssBytes,
      resourceMaxRssBytes: this.resourceMaxRssBytes,
      matches,
      plies,
      msPerMatch: wallClockMs / Math.max(1, matches),
      msPerPly: wallClockMs / Math.max(1, plies),
      engineCallsPerPly: calls.engineCalls / Math.max(1, plies),
      matchCosts: [...this.matchCosts],
    };
  }

  private record(
    calls: MutableCalls,
    field:
      | 'evaluateCalls'
      | 'multiPvAtCalls'
      | 'multiPvAtMaxCalls'
      | 'bestAtCalls',
    depth: number | 'max',
  ): void {
    calls[field] += 1;
    const bucket = typeof depth === 'number' ? String(depth) : depth;
    calls.depthHistogram.set(
      bucket,
      (calls.depthHistogram.get(bucket) ?? 0) + 1,
    );
    this.sample();
  }

  private restarts(): number {
    return this.engine.getCostStats?.().restarts ?? 0;
  }

  private sample(): void {
    const snapshot = sampleRss();
    this.peakRssBytes = Math.max(this.peakRssBytes, snapshot.rss);
    this.resourceMaxRssBytes = Math.max(
      this.resourceMaxRssBytes,
      snapshot.maxRss,
    );
  }
}

export function instrumentEngine(
  engine: EnginePort,
  tracker: CostTracker,
): EnginePort {
  return {
    determinismId: engine.determinismId,
    async evaluate(fen, depth, evalProfile) {
      tracker.recordEvaluate(depth);
      return engine.evaluate(fen, depth, evalProfile);
    },
    ...(engine.multiPvAt === undefined
      ? {}
      : {
          multiPvAt: async (fen: string, depth: number) => {
            tracker.recordMultiPvAt(depth);
            return engine.multiPvAt?.(fen, depth) ?? [];
          },
        }),
    ...(engine.multiPvAtMax === undefined
      ? {}
      : {
          multiPvAtMax: async (fen: string) => {
            tracker.recordMultiPvAtMax();
            return engine.multiPvAtMax?.(fen) ?? [];
          },
        }),
    ...(engine.bestAt === undefined
      ? {}
      : {
          bestAt: async (fen: string, depth: number) => {
            tracker.recordBestAt(depth);
            return (
              engine.bestAt?.(fen, depth) ?? { scoreCp: 0, pv: [] as string[] }
            );
          },
        }),
    ...(engine.getCostStats === undefined
      ? {}
      : { getCostStats: engine.getCostStats }),
  };
}

export function shardCost(
  startedAt: bigint,
  campaignCosts: readonly {
    readonly campaignIndex: number;
    readonly campaignSeed: number;
    readonly cost: CampaignCost;
  }[],
): ShardCost {
  const matchCosts = campaignCosts.flatMap((campaign) =>
    campaign.cost.matchCosts.map((cost) => ({ ...cost })),
  );
  const calls = emptyCalls();
  for (const campaign of campaignCosts) {
    calls.evaluateCalls += campaign.cost.evaluateCalls;
    calls.multiPvAtCalls += campaign.cost.multiPvAtCalls;
    calls.multiPvAtMaxCalls += campaign.cost.multiPvAtMaxCalls;
    calls.bestAtCalls += campaign.cost.bestAtCalls;
    for (const [depth, count] of Object.entries(campaign.cost.depthHistogram)) {
      calls.depthHistogram.set(
        depth,
        (calls.depthHistogram.get(depth) ?? 0) + count,
      );
    }
  }
  const snapshot = callsSnapshot(calls);
  const matches = matchCosts.length;
  const plies = matchCosts.reduce((sum, cost) => sum + cost.plies, 0);
  const wallClockMs = elapsedMs(startedAt);
  return {
    ...snapshot,
    wallClockMs,
    restarts: campaignCosts.reduce(
      (sum, campaign) => sum + campaign.cost.restarts,
      0,
    ),
    peakRssBytes: Math.max(
      0,
      ...campaignCosts.map((campaign) => campaign.cost.peakRssBytes),
    ),
    resourceMaxRssBytes: Math.max(
      0,
      ...campaignCosts.map((campaign) => campaign.cost.resourceMaxRssBytes),
    ),
    matches,
    campaigns: campaignCosts.length,
    plies,
    msPerMatch: wallClockMs / Math.max(1, matches),
    msPerPly: wallClockMs / Math.max(1, plies),
    engineCallsPerPly: snapshot.engineCalls / Math.max(1, plies),
    matchCosts,
    campaignCosts,
  };
}
