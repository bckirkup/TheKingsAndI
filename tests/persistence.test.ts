import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapRoster } from '../src/app/careerBootstrap';
import {
  CareerRepository,
  assertSchemaVersion,
  getDatabase,
  MIGRATIONS,
  resetDatabaseForTests,
  SCHEMA_VERSION,
} from '../src/persistence';

describe('persistence repository', () => {
  let testCounter = 0;

  beforeEach(() => {
    testCounter += 1;
    resetDatabaseForTests(`test-${testCounter}`);
  });

  afterEach(async () => {
    await getDatabase().delete();
  });

  it('creates a career with deterministic ids for the same seed', async () => {
    const repo = new CareerRepository();
    await repo.init();
    const { roster, identities } = bootstrapRoster(99);

    const first = await repo.createCareer({
      seed: 99,
      roster,
      identities,
      targetMatches: 5,
    });
    const secondDb = resetDatabaseForTests('test-deterministic');
    const repo2 = new CareerRepository(secondDb);
    await repo2.init();
    const second = await repo2.createCareer({
      seed: 99,
      roster,
      identities,
      targetMatches: 5,
    });

    expect(first.career.id).toBe(second.career.id);
    expect(first.campaign.id).toBe(second.campaign.id);
  });

  it('resumes an active campaign instead of creating duplicates', async () => {
    const repo = new CareerRepository();
    await repo.init();
    const { roster, identities } = bootstrapRoster(7);
    await repo.createCareer({ seed: 7, roster, identities, targetMatches: 3 });

    const loaded = await repo.loadActiveCampaign();
    expect(loaded).not.toBeNull();
    expect(loaded?.matchCount).toBe(0);
    expect(loaded?.roster).toHaveLength(16);
  });

  it('migrates legacy credence accounts with zero ability observations', async () => {
    const repo = new CareerRepository();
    await repo.init();
    const { roster, identities } = bootstrapRoster(17);
    await repo.createCareer({ seed: 17, roster, identities, targetMatches: 1 });
    const db = getDatabase();
    const legacy = roster[0];
    if (legacy === undefined) throw new Error('expected bootstrap roster');
    await db.pieceStates.put({
      ...legacy,
      credence: { tauBenev: 50, tauAbil: 50 },
    } as typeof legacy);

    const migrated = (await repo.getRoster()).find(
      (piece) => piece.id === legacy.id,
    );
    expect(migrated?.credence.abilityObservationCount).toBe(0);
  });

  it('records matches and builds a debrief fold', async () => {
    const repo = new CareerRepository();
    await repo.init();
    const { roster, identities } = bootstrapRoster(11);
    const created = await repo.createCareer({
      seed: 11,
      roster,
      identities,
      targetMatches: 2,
    });

    await repo.recordMatch({
      campaignId: created.campaign.id,
      actId: created.act.id,
      matchIndex: 1,
      seed: 11,
      rosterSnapshot: created.roster,
      rosterEnd: created.roster,
      events: [
        {
          t: 'MOVE',
          ply: 1,
          san: 'e4',
          pieceId: created.roster[8]?.id ?? 'w:P:e2',
          verdict: 'COMPLIANT_EXECUTION',
        },
      ],
      engineAudit: [
        {
          ply: 1,
          pieceId: created.roster[8]?.id ?? 'w:P:e2',
          san: 'e4',
          preMoveScoreCp: 0,
          scoreCp: 25,
          bestScoreCp: 30,
          preMoveDepth: 16,
          scoreDepth: 8,
          bestScoreDepth: 16,
        },
      ],
      result: 'DRAW',
    });

    const loaded = await repo.loadActiveCampaign();
    expect(loaded?.matchCount).toBe(1);
    const stored = await getDatabase().matches.toArray();
    expect(stored[0]?.engineAudit).toHaveLength(1);

    const debrief = await repo.buildDebrief(created.campaign.id);
    expect(debrief.matches).toHaveLength(1);
    expect(debrief.meanBoardQuality).toBeGreaterThan(0);
    expect(debrief.foldVersion).toBeTruthy();
  });
});

describe('schema migrations', () => {
  beforeEach(() => {
    resetDatabaseForTests('migration-test');
  });

  it('stamps and asserts the current schema version', async () => {
    const repo = new CareerRepository();
    await repo.init();
    const version = await assertSchemaVersion(getDatabase());
    expect(version).toBe(SCHEMA_VERSION);
  });

  it('declares a migration step for each schema version', () => {
    expect(MIGRATIONS.some((step) => step.version === SCHEMA_VERSION)).toBe(
      true,
    );
  });

  it('loads a v1 fixture and runs declared migrations without drift', async () => {
    const fixture = (
      await import('./fixtures/persistence-v1-career.json', {
        with: { type: 'json' },
      })
    ).default as {
      schemaVersion: number;
      career: { id: string; seed: number };
      campaign: { id: string; targetMatches: number };
      settings: readonly { key: string; value: string }[];
    };

    expect(fixture.schemaVersion).toBe(1);
    const db = resetDatabaseForTests('migration-fixture-v1');
    await db.open();
    for (const step of MIGRATIONS) {
      if (step.version <= fixture.schemaVersion) {
        await step.upgrade(db);
      }
    }
    await db.settings.put({
      key: 'schemaVersion',
      value: String(SCHEMA_VERSION),
    });
    await db.careers.put({
      id: fixture.career.id,
      seed: fixture.career.seed,
      schemaVersion: SCHEMA_VERSION,
      outcome: 'ongoing',
      actIds: ['act_fixture_v1'],
      createdAt: 1,
    });
    await db.campaigns.put({
      id: fixture.campaign.id,
      actId: 'act_fixture_v1',
      matchIds: [],
      targetMatches: fixture.campaign.targetMatches,
      cultureDriftFoldVersion: 'v1',
    });

    const version = await assertSchemaVersion(db);
    expect(version).toBe(SCHEMA_VERSION);
    const career = await db.careers.get(fixture.career.id);
    expect(career?.seed).toBe(42);
    const campaign = await db.campaigns.get(fixture.campaign.id);
    expect(campaign?.targetMatches).toBe(5);
  });
});
