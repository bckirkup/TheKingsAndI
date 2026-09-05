import {
  ENGINE_CONFIG,
  prideAppraisalDelta,
  prideAppraisalSum,
  prideExpectationAfter,
  type PieceRole,
} from '../src/psychology';
import type { CommanderPool } from './pool';
import { roleExpectationPrice, type DraftSettlement } from './seminarDraft';
import type { RansomLedgerEntry } from './ransom';
import type { SeminarConfig } from './seminarConfig';

export type PricingKind = 'ransom' | 'draft';

export interface PricingEvent {
  readonly cycle: number;
  readonly kind: PricingKind;
  readonly ownerId: string;
  readonly pieceId: string;
  readonly role: PieceRole;
  readonly price: number;
}

export interface PrideAppraisalStep {
  readonly cycle: number;
  readonly kind: PricingKind;
  readonly price: number;
  readonly expectation: number;
  readonly delta: number;
}

export interface PrideCareer {
  readonly pieceId: string;
  readonly role: PieceRole;
  readonly ownerId: string;
  readonly appraisal: number;
  readonly steps: readonly PrideAppraisalStep[];
}

export interface PrideReading {
  readonly proud: readonly PrideCareer[];
  readonly wounded: readonly PrideCareer[];
}

export const EMPTY_PRIDE: PrideReading = { proud: [], wounded: [] };

export function pricingEventsForCycle(
  cycle: number,
  ransoms: readonly RansomLedgerEntry[],
  settlements: readonly DraftSettlement[],
  poolsBeforeDraft: ReadonlyMap<string, CommanderPool>,
): readonly PricingEvent[] {
  const ransomEvents = ransoms.map((entry) => {
    const ownerPool = poolsBeforeDraft.get(entry.ownerId);
    const captive = ownerPool?.members.find(
      (member) => member.state.id === entry.captiveId,
    );
    if (captive === undefined) {
      throw new Error(
        `Missing ransom captive ${entry.captiveId} in owner pool ${entry.ownerId}.`,
      );
    }
    return {
      cycle,
      kind: 'ransom' as const,
      ownerId: entry.ownerId,
      pieceId: entry.captiveId,
      role: captive.state.role,
      price: entry.price,
    };
  });
  return [
    ...ransomEvents,
    ...settlements.map((settlement) => ({
      cycle,
      kind: 'draft' as const,
      ownerId: settlement.ownerId,
      pieceId: settlement.pieceId,
      role: settlement.role,
      price: settlement.clearingPrice,
    })),
  ];
}

export function foldPride(
  events: readonly PricingEvent[],
  config: SeminarConfig,
  ema: number = ENGINE_CONFIG.PRIDE_EXPECTATION_EMA_PERMILLE,
  floor: number = ENGINE_CONFIG.PRIDE_NAMING_FLOOR_PERMILLE,
): Readonly<Record<string, PrideReading>> {
  const movement = Math.max(0, Math.min(1_000, Math.trunc(ema)));
  if (movement === 0) return {};
  const namingFloor = Math.max(0, Math.trunc(floor));
  const threshold = Math.max(1, namingFloor);
  const careers = new Map<
    string,
    {
      role: PieceRole;
      ownerId: string;
      expectation: number;
      appraisal: number;
      steps: PrideAppraisalStep[];
    }
  >();

  for (const event of events) {
    const career =
      careers.get(event.pieceId) ??
      (() => {
        const created = {
          role: event.role,
          ownerId: event.ownerId,
          expectation: roleExpectationPrice(event.role, config),
          appraisal: 0,
          steps: [],
        };
        careers.set(event.pieceId, created);
        return created;
      })();
    const expectation = career.expectation;
    const delta = prideAppraisalDelta(event.price, expectation);
    career.steps.push({
      cycle: event.cycle,
      kind: event.kind,
      price: event.price,
      expectation,
      delta,
    });
    career.expectation = prideExpectationAfter(
      event.price,
      expectation,
      movement,
    );
    career.appraisal = prideAppraisalSum(career.appraisal, delta);
    career.role = event.role;
    career.ownerId = event.ownerId;
  }

  const readings = new Map<string, PrideReading>();
  for (const [pieceId, career] of careers) {
    const result: PrideCareer = {
      pieceId,
      role: career.role,
      ownerId: career.ownerId,
      appraisal: prideAppraisalSum(0, career.appraisal),
      steps: career.steps,
    };
    const appraisal = result.appraisal;
    if (appraisal > 0 && appraisal >= threshold) {
      const reading = readings.get(career.ownerId) ?? EMPTY_PRIDE;
      readings.set(career.ownerId, {
        proud: [...reading.proud, result],
        wounded: reading.wounded,
      });
    } else if (appraisal < 0 && -appraisal >= threshold) {
      const reading = readings.get(career.ownerId) ?? EMPTY_PRIDE;
      readings.set(career.ownerId, {
        proud: reading.proud,
        wounded: [...reading.wounded, result],
      });
    }
  }

  return Object.fromEntries(
    [...readings.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ownerId, reading]) => [
        ownerId,
        {
          proud: [...reading.proud].sort((left, right) =>
            left.pieceId.localeCompare(right.pieceId),
          ),
          wounded: [...reading.wounded].sort((left, right) =>
            left.pieceId.localeCompare(right.pieceId),
          ),
        },
      ]),
  );
}
