import { DRAFT_CONFIG, type DraftConfig } from './draftConfig';

export interface CommanderStanding {
  readonly commanderId: string;
  /** Higher standing is better. */
  readonly standing: number;
  /** Higher externality is better for the cohort. */
  readonly cohortExternality: number;
}

export interface DraftPriority {
  readonly commanderId: string;
  readonly standing: number;
  readonly cohortExternality: number;
  readonly priorityScore: number;
  readonly priorityRank: number;
  readonly purse: number;
}

export interface AcceptanceEvidence {
  readonly relationshipAccount?: { readonly tauBenev: number };
  readonly disposition: { readonly tauBenev: number };
  /** Roster testimony is a bounded private signal, 0..100. */
  readonly rosterTestimony: number;
}

export type AcceptancePriceBand =
  | 'will_come_cheap'
  | 'asks_the_going_rate'
  | 'drives_a_hard_bargain'
  | 'wants_danger_money';

export interface DraftLot {
  readonly lotId: string;
  readonly basePrice: number;
  readonly minimumBid?: number;
}

export type DraftBidStyle = 'cautious' | 'balanced' | 'aggressive';

export interface DraftBidder {
  readonly commanderId: string;
  readonly priorityRank: number;
  readonly purse: number;
  readonly style: DraftBidStyle;
  readonly acceptanceDiscountPermille: number;
}

export interface DraftBid {
  readonly commanderId: string;
  readonly lotId: string;
  readonly amount: number;
}

export interface ClearedDraftLot {
  readonly lotId: string;
  readonly winnerId?: string;
  readonly clearingPrice: number;
  readonly minimumBid: number;
}

export interface DraftClearing {
  readonly lots: readonly ClearedDraftLot[];
  readonly remainingPurses: Readonly<Record<string, number>>;
}

function boundedInteger(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

/**
 * Fold standing and cohort externalities into reverse priority. Award
 * identifiers are intentionally absent: priority measures the cohort, not
 * commendations (ADR 0059 §7).
 */
export function draftPriority(
  standings: readonly CommanderStanding[],
  config: DraftConfig = DRAFT_CONFIG,
): readonly DraftPriority[] {
  const ordered = [...standings].sort(
    (left, right) =>
      left.standing +
        left.cohortExternality -
        (right.standing + right.cohortExternality) ||
      left.commanderId.localeCompare(right.commanderId),
  );
  const denominator = Math.max(1, ordered.length - 1);
  return ordered.map((commander, priorityRank) => ({
    ...commander,
    priorityScore: commander.standing + commander.cohortExternality,
    priorityRank,
    purse:
      Math.max(0, Math.trunc(config.PURSE_BASE)) +
      Math.floor(
        (Math.max(0, Math.trunc(config.PURSE_SPREAD)) *
          (ordered.length - 1 - priorityRank)) /
          denominator,
      ),
  }));
}

/**
 * Compute the private acceptance discount. Served commanders use their
 * relationship account; otherwise the identity prior and roster testimony
 * provide the only evidence.
 */
export function acceptanceDiscountPermille(
  evidence: AcceptanceEvidence,
  config: DraftConfig = DRAFT_CONFIG,
): number {
  const reputation =
    evidence.relationshipAccount?.tauBenev ??
    Math.floor(
      (boundedInteger(evidence.disposition.tauBenev, 0, 100) +
        boundedInteger(evidence.rosterTestimony, 0, 100)) /
        2,
    );
  return boundedInteger(
    (Math.max(0, Math.trunc(config.ACCEPTANCE_DISCOUNT_PERMILLE)) *
      boundedInteger(reputation, 0, 100)) /
      100,
    0,
    1000,
  );
}

export function acceptedPrice(
  basePrice: number,
  discountPermille: number,
): number {
  return Math.max(
    0,
    Math.floor(
      (Math.max(0, Math.trunc(basePrice)) *
        (1000 - boundedInteger(discountPermille, 0, 1000))) /
        1000,
    ),
  );
}

/**
 * Fold a private acceptance discount into a qualitative salary negotiation
 * label. Thresholds are fractions of the configured maximum discount, not
 * raw prices or raw discounts.
 */
export function acceptancePriceBand(
  discountPermille: number,
  config: DraftConfig = DRAFT_CONFIG,
): AcceptancePriceBand {
  const maximumDiscount = boundedInteger(
    config.ACCEPTANCE_DISCOUNT_PERMILLE,
    0,
    1000,
  );
  if (maximumDiscount === 0) return 'wants_danger_money';
  const discount = boundedInteger(discountPermille, 0, maximumDiscount);
  const cheapThreshold = boundedInteger(
    config.ACCEPTANCE_BAND_CHEAP_PERMILLE,
    0,
    1000,
  );
  const goingRateThreshold = boundedInteger(
    config.ACCEPTANCE_BAND_GOING_RATE_PERMILLE,
    0,
    1000,
  );
  const hardBargainThreshold = boundedInteger(
    config.ACCEPTANCE_BAND_HARD_BARGAIN_PERMILLE,
    0,
    1000,
  );
  if (discount * 1000 >= maximumDiscount * cheapThreshold) {
    return 'will_come_cheap';
  }
  if (discount * 1000 >= maximumDiscount * goingRateThreshold) {
    return 'asks_the_going_rate';
  }
  if (discount * 1000 >= maximumDiscount * hardBargainThreshold) {
    return 'drives_a_hard_bargain';
  }
  return 'wants_danger_money';
}

function bidMultiplierForNonCautious(
  style: Exclude<DraftBidStyle, 'cautious'>,
  config: DraftConfig,
): number {
  if (style === 'balanced') return config.BID_MULTIPLIER_BALANCED;
  return config.BID_MULTIPLIER_AGGRESSIVE;
}

export function bidForLot(
  bidder: DraftBidder,
  lot: DraftLot,
  config: DraftConfig = DRAFT_CONFIG,
): DraftBid {
  const minimumBid = Math.max(
    0,
    Math.trunc(lot.minimumBid ?? config.MINIMUM_BID),
  );
  const target = acceptedPrice(
    lot.basePrice,
    bidder.acceptanceDiscountPermille,
  );
  const multiplier =
    bidder.style === 'cautious'
      ? config.BID_MULTIPLIER_CAUTIOUS
      : bidMultiplierForNonCautious(bidder.style, config);
  const suggested = Math.floor(
    (target * Math.max(0, Math.trunc(multiplier))) / 1000,
  );
  return {
    commanderId: bidder.commanderId,
    lotId: lot.lotId,
    amount: boundedInteger(
      Math.min(bidder.purse, Math.max(minimumBid, suggested)),
      0,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

/**
 * Clear lots in deterministic input order. Priority breaks bid ties and can
 * claim a near-top bid when the configured first-refusal margin allows it.
 */
export function clearDraft(
  lots: readonly DraftLot[],
  bidders: readonly DraftBidder[],
  config: DraftConfig = DRAFT_CONFIG,
): DraftClearing {
  const remaining = new Map(
    bidders.map((bidder) => [bidder.commanderId, Math.max(0, bidder.purse)]),
  );
  const rankByCommander = new Map(
    bidders.map((bidder) => [bidder.commanderId, bidder.priorityRank]),
  );
  const firstRefusalMargin = boundedInteger(
    config.FIRST_REFUSAL_MARGIN_PERMILLE,
    0,
    1000,
  );
  const results: ClearedDraftLot[] = [];
  for (const lot of lots) {
    const minimumBid = Math.max(
      0,
      Math.trunc(lot.minimumBid ?? config.MINIMUM_BID),
    );
    const bids = bidders
      .map((bidder) => {
        const purse = remaining.get(bidder.commanderId) ?? 0;
        const bid = bidForLot({ ...bidder, purse }, { ...lot }, config);
        return bid.amount > purse ? undefined : bid;
      })
      .filter((bid): bid is DraftBid => bid !== undefined)
      .filter((bid) => bid.amount >= minimumBid);
    bids.sort((left, right) => {
      if (right.amount !== left.amount) return right.amount - left.amount;
      const leftRank = rankByCommander.get(left.commanderId);
      const rightRank = rankByCommander.get(right.commanderId);
      return (
        (leftRank ?? Number.MAX_SAFE_INTEGER) -
          (rightRank ?? Number.MAX_SAFE_INTEGER) ||
        left.commanderId.localeCompare(right.commanderId)
      );
    });
    const topBid = bids[0];
    const winner =
      topBid === undefined
        ? undefined
        : bids
            .filter(
              (bid) =>
                bid.amount * 1000 >=
                topBid.amount * (1000 - firstRefusalMargin),
            )
            .sort(
              (left, right) =>
                (rankByCommander.get(left.commanderId) ??
                  Number.MAX_SAFE_INTEGER) -
                  (rankByCommander.get(right.commanderId) ??
                    Number.MAX_SAFE_INTEGER) ||
                left.commanderId.localeCompare(right.commanderId),
            )[0];
    if (winner === undefined) {
      results.push({
        lotId: lot.lotId,
        clearingPrice: 0,
        minimumBid,
      });
      continue;
    }
    remaining.set(
      winner.commanderId,
      (remaining.get(winner.commanderId) ?? 0) - winner.amount,
    );
    results.push({
      lotId: lot.lotId,
      winnerId: winner.commanderId,
      clearingPrice: winner.amount,
      minimumBid,
    });
  }
  return {
    lots: results,
    remainingPurses: Object.fromEntries(remaining),
  };
}

export function carryPurse(
  unspent: number,
  config: DraftConfig = DRAFT_CONFIG,
): number {
  return Math.floor(
    (Math.max(0, Math.trunc(unspent)) *
      boundedInteger(config.PURSE_CARRY_PERMILLE, 0, 1000)) /
      1000,
  );
}
