import { createSeededRandom } from '../core/random';

import { getDatabase } from './db';
import { buildCampaignDebrief, foldMatchAudit } from './folds';
import { stampSchemaVersion } from './migrations';
import type {
  ActRecord,
  CampaignDebrief,
  CampaignRecord,
  CareerRecord,
  MatchRecord,
  PieceIdentityRecord,
  StoredPieceState,
} from './types';
import {
  DETERMINISM_ID,
  PSYCH_CONFIG_VERSION,
  SCHEMA_VERSION,
  CULTURE_DRIFT_FOLD_VERSION,
} from './types';

function deterministicId(
  prefix: string,
  seed: number,
  counter: number,
): string {
  const rng = createSeededRandom(seed ^ (counter * 0x9e3779b9));
  return `${prefix}-${rng.nextUint32().toString(16)}`;
}

function meanTrust(roster: readonly StoredPieceState[]): number {
  if (roster.length === 0) return 0;
  return roster.reduce((sum, piece) => sum + piece.T_i, 0) / roster.length;
}

export class CareerRepository {
  constructor(private readonly db = getDatabase()) {}

  async init(): Promise<void> {
    await this.db.open();
    await stampSchemaVersion(this.db);
  }

  async loadActiveCampaign(): Promise<{
    readonly career: CareerRecord;
    readonly act: ActRecord;
    readonly campaign: CampaignRecord;
    readonly roster: StoredPieceState[];
    readonly matchCount: number;
  } | null> {
    const careers = await this.db.careers
      .orderBy('createdAt')
      .reverse()
      .toArray();
    const career = careers[0];
    if (career === undefined) return null;

    const actId = career.actIds[0];
    if (actId === undefined) return null;
    const act = await this.db.acts.get(actId);
    if (act === undefined) return null;

    const campaigns = await this.db.campaigns
      .where('actId')
      .equals(act.id)
      .toArray();
    const campaign = campaigns[0];
    if (campaign === undefined) return null;

    const matches = await this.listMatches(campaign.id);
    return {
      career,
      act,
      campaign,
      roster: await this.getRoster(),
      matchCount: matches.length,
    };
  }

  async createCareer(input: {
    readonly seed: number;
    readonly roster: readonly StoredPieceState[];
    readonly identities: readonly PieceIdentityRecord[];
    readonly targetMatches?: number;
  }): Promise<{
    readonly career: CareerRecord;
    readonly act: ActRecord;
    readonly campaign: CampaignRecord;
    readonly roster: StoredPieceState[];
  }> {
    const roster = [...input.roster];
    let counter = 0;

    const careerId = deterministicId('career', input.seed, counter++);
    const actId = deterministicId('act', input.seed, counter++);
    const campaignId = deterministicId('campaign', input.seed, counter++);
    const career: CareerRecord = {
      id: careerId,
      seed: input.seed,
      schemaVersion: SCHEMA_VERSION,
      outcome: 'ongoing',
      actIds: [actId],
      createdAt: Date.now(),
    };
    const act: ActRecord = {
      id: actId,
      careerId,
      kingId: 'w:K:e1',
      matchIds: [],
      terminalState: 'ongoing',
      kingsRemaining: 3,
    };
    const campaign: CampaignRecord = {
      id: campaignId,
      actId,
      matchIds: [],
      targetMatches: input.targetMatches ?? 5,
      cultureDriftFoldVersion: CULTURE_DRIFT_FOLD_VERSION,
    };

    await this.db.transaction(
      'rw',
      this.db.careers,
      this.db.acts,
      this.db.campaigns,
      this.db.pieceIdentities,
      this.db.pieceStates,
      async () => {
        await this.db.careers.put(career);
        await this.db.acts.put(act);
        await this.db.campaigns.put(campaign);
        await this.db.pieceIdentities.bulkPut([...input.identities]);
        await this.db.pieceStates.bulkPut(roster);
      },
    );

    return { career, act, campaign, roster };
  }

  async getRoster(): Promise<StoredPieceState[]> {
    return this.db.pieceStates.toArray();
  }

  async saveRoster(roster: readonly StoredPieceState[]): Promise<void> {
    await this.db.pieceStates.bulkPut([...roster]);
  }

  async getCampaign(campaignId: string): Promise<CampaignRecord | undefined> {
    return this.db.campaigns.get(campaignId);
  }

  async getAct(actId: string): Promise<ActRecord | undefined> {
    return this.db.acts.get(actId);
  }

  async listMatches(campaignId: string): Promise<MatchRecord[]> {
    return this.db.matches
      .where('campaignId')
      .equals(campaignId)
      .sortBy('matchIndex');
  }

  async recordMatch(input: {
    readonly campaignId: string;
    readonly actId: string;
    readonly matchIndex: number;
    readonly seed: number;
    readonly rosterSnapshot: readonly StoredPieceState[];
    readonly rosterEnd: readonly StoredPieceState[];
    readonly events: MatchRecord['events'];
    readonly result: MatchRecord['result'];
  }): Promise<MatchRecord> {
    const matchId = deterministicId(
      'match',
      input.seed,
      input.matchIndex * 1_000_003,
    );
    const audit = foldMatchAudit(
      input.events,
      meanTrust(input.rosterSnapshot),
      meanTrust(input.rosterEnd),
    );
    const record: MatchRecord = {
      id: matchId,
      campaignId: input.campaignId,
      actId: input.actId,
      matchIndex: input.matchIndex,
      seed: input.seed,
      rosterSnapshot: input.rosterSnapshot,
      rosterEnd: input.rosterEnd,
      events: input.events,
      result: input.result,
      audit,
      determinismId: DETERMINISM_ID,
      psychConfigVersion: PSYCH_CONFIG_VERSION,
      schemaVersion: SCHEMA_VERSION,
    };

    await this.db.transaction(
      'rw',
      this.db.matches,
      this.db.campaigns,
      this.db.acts,
      this.db.pieceStates,
      async () => {
        await this.db.matches.put(record);
        const campaign = await this.db.campaigns.get(input.campaignId);
        if (campaign !== undefined) {
          await this.db.campaigns.put({
            ...campaign,
            matchIds: [...campaign.matchIds, matchId],
          });
        }
        const act = await this.db.acts.get(input.actId);
        if (act !== undefined) {
          await this.db.acts.put({
            ...act,
            matchIds: [...act.matchIds, matchId],
          });
        }
        await this.db.pieceStates.bulkPut([...input.rosterEnd]);
      },
    );

    return record;
  }

  async buildDebrief(campaignId: string): Promise<CampaignDebrief> {
    const matches = await this.listMatches(campaignId);
    if (matches.length === 0) {
      throw new Error('No matches recorded for campaign.');
    }
    const initialRoster = matches[0]?.rosterSnapshot ?? [];
    const finalRoster = matches.at(-1)?.rosterEnd ?? [];
    return buildCampaignDebrief(
      campaignId,
      matches,
      initialRoster,
      finalRoster,
    );
  }
}
