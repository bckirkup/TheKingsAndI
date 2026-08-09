import { createSeededRandom } from '../core/random';

import { getDatabase } from './db';
import { buildCampaignDebrief, foldMatchAudit } from './folds';
import { stampSchemaVersion } from './migrations';
import type {
  ActRecord,
  ActTerminalState,
  CampaignDebrief,
  CampaignRecord,
  CareerOutcome,
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

function normalizeAct(act: ActRecord): ActRecord {
  return {
    ...act,
    playerSuspended: act.playerSuspended ?? false,
    opponentArchetype: act.opponentArchetype ?? 'tyrannical',
    kingTauAbil: act.kingTauAbil ?? 50,
    appointmentIndex: act.appointmentIndex ?? 1,
    diminished: act.diminished ?? false,
  };
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
    const rawAct = await this.db.acts.get(actId);
    if (rawAct === undefined) return null;
    const act = normalizeAct(rawAct);

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
      playerSuspended: false,
      opponentArchetype: 'tyrannical',
      kingTauAbil: 50,
      appointmentIndex: 1,
      diminished: false,
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

  async updateCampaignTarget(
    campaignId: string,
    targetMatches: number,
  ): Promise<void> {
    const campaign = await this.db.campaigns.get(campaignId);
    if (campaign === undefined) return;
    await this.db.campaigns.put({ ...campaign, targetMatches });
  }

  async getAct(actId: string): Promise<ActRecord | undefined> {
    const act = await this.db.acts.get(actId);
    return act === undefined ? undefined : normalizeAct(act);
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
          const nextAct: ActRecord = {
            ...act,
            matchIds: [...act.matchIds, matchId],
            ...(input.result === 'DISMISSED'
              ? {
                  kingsRemaining: Math.max(0, act.kingsRemaining - 1),
                  playerSuspended: true,
                }
              : {}),
          };
          await this.db.acts.put(nextAct);
        }
        await this.db.pieceStates.bulkPut([...input.rosterEnd]);
      },
    );

    return record;
  }

  async updateCampaignTerminal(input: {
    readonly actId: string;
    readonly careerId: string;
    readonly terminalState: ActTerminalState;
    readonly careerOutcome: CareerOutcome;
  }): Promise<void> {
    const act = await this.db.acts.get(input.actId);
    const career = await this.db.careers.get(input.careerId);
    if (act === undefined || career === undefined) return;
    await this.db.transaction('rw', this.db.acts, this.db.careers, async () => {
      await this.db.acts.put({ ...act, terminalState: input.terminalState });
      await this.db.careers.put({ ...career, outcome: input.careerOutcome });
    });
  }

  async reinstatePlayer(actId: string): Promise<void> {
    const act = await this.db.acts.get(actId);
    if (act === undefined) return;
    await this.db.acts.put({ ...act, playerSuspended: false });
  }

  async createDiminishedAppointment(input: {
    readonly careerId: string;
    readonly seed: number;
    readonly kingId?: string;
    readonly opponentArchetype?: ActRecord['opponentArchetype'];
    readonly targetMatches?: number;
    readonly kingsRemaining?: number;
  }): Promise<{
    readonly career: CareerRecord;
    readonly act: ActRecord;
    readonly campaign: CampaignRecord;
  }> {
    const career = await this.db.careers.get(input.careerId);
    if (career === undefined) {
      throw new Error(`Career not found: ${input.careerId}`);
    }
    const appointmentIndex = career.actIds.length + 1;
    if (appointmentIndex > 3) {
      throw new Error('Career already has three appointments.');
    }
    let counter = career.actIds.length * 17 + 1;
    const actId = deterministicId('act', input.seed, counter++);
    const campaignId = deterministicId('campaign', input.seed, counter++);
    const act: ActRecord = {
      id: actId,
      careerId: career.id,
      kingId: input.kingId ?? 'w:K:e1',
      matchIds: [],
      terminalState: 'ongoing',
      kingsRemaining: input.kingsRemaining ?? 2,
      playerSuspended: false,
      opponentArchetype: input.opponentArchetype ?? 'tyrannical',
      kingTauAbil: 45,
      appointmentIndex,
      diminished: appointmentIndex >= 2,
    };
    const campaign: CampaignRecord = {
      id: campaignId,
      actId,
      matchIds: [],
      targetMatches: input.targetMatches ?? 5,
      cultureDriftFoldVersion: CULTURE_DRIFT_FOLD_VERSION,
    };
    const nextCareer: CareerRecord = {
      ...career,
      actIds: [...career.actIds, actId],
      outcome: 'ongoing',
    };
    await this.db.transaction(
      'rw',
      this.db.careers,
      this.db.acts,
      this.db.campaigns,
      async () => {
        await this.db.careers.put(nextCareer);
        await this.db.acts.put(act);
        await this.db.campaigns.put(campaign);
      },
    );
    return { career: nextCareer, act, campaign };
  }

  async listFreeAgents(): Promise<StoredPieceState[]> {
    return this.db.pieceStates.where('status').equals('DESERTED').toArray();
  }

  async getIdentities(
    pieceIds: readonly string[],
  ): Promise<PieceIdentityRecord[]> {
    return this.db.pieceIdentities
      .where('id')
      .anyOf([...pieceIds])
      .toArray();
  }

  async buildCertificate(
    campaignId: string,
  ): Promise<import('./types').CertificateBundle> {
    const { buildCertificateBundle } = await import('./certificate');
    const matches = await this.listMatches(campaignId);
    if (matches.length === 0) {
      throw new Error('No matches recorded for campaign.');
    }
    const campaign = await this.getCampaign(campaignId);
    const actId = matches[0]?.actId;
    const act = actId === undefined ? undefined : await this.getAct(actId);
    const careerId = act?.careerId;
    const career =
      careerId === undefined ? undefined : await this.db.careers.get(careerId);
    if (career === undefined || campaign === undefined) {
      throw new Error('Career not found for campaign.');
    }
    return buildCertificateBundle({
      career,
      campaignId,
      matches,
      initialRoster: matches[0]?.rosterSnapshot ?? [],
      finalRoster: matches.at(-1)?.rosterEnd ?? [],
      actTerminalState: act?.terminalState ?? 'ongoing',
    });
  }

  async buildDebrief(campaignId: string): Promise<CampaignDebrief> {
    const matches = await this.listMatches(campaignId);
    if (matches.length === 0) {
      throw new Error('No matches recorded for campaign.');
    }
    const actId = matches[0]?.actId;
    const act = actId === undefined ? undefined : await this.db.acts.get(actId);
    const initialRoster = matches[0]?.rosterSnapshot ?? [];
    const finalRoster = matches.at(-1)?.rosterEnd ?? [];
    const terminal = act?.terminalState ?? 'ongoing';
    return buildCampaignDebrief(
      campaignId,
      matches,
      initialRoster,
      finalRoster,
      terminal,
    );
  }
}
