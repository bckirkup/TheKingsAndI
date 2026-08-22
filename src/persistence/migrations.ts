import type { LivingChessDatabase } from './db';
import { PLAYER_LEADER_ID } from '../core/ids';
import { defaultCredence } from '../psychology';
import { identityCreationSeed } from '../orchestration';
import { SCHEMA_VERSION } from './types';

export interface MigrationStep {
  readonly version: number;
  readonly upgrade: (db: LivingChessDatabase) => Promise<void>;
}

/** Forward-only migrations keyed by schema version. */
export const MIGRATIONS: readonly MigrationStep[] = [
  {
    version: 1,
    upgrade: async () => {
      // v1 is created by Dexie's version(1) stores definition.
    },
  },
  {
    version: 2,
    upgrade: async () => {
      // v2 keeps legacy members and their identity roles intact. Squad depth
      // applies only to newly bootstrapped careers.
    },
  },
  {
    version: 3,
    upgrade: async (db) => {
      const identities = await db.pieceIdentities.toArray();
      const pieces = new Map(
        (await db.pieceStates.toArray()).map((piece) => [piece.id, piece]),
      );
      await db.pieceIdentities.bulkPut(
        identities.map((identity) => {
          const piece = pieces.get(identity.id);
          const disposition = identity.disposition ?? defaultCredence();
          const account =
            identity.relationshipAccounts?.[PLAYER_LEADER_ID] ??
            piece?.credence ??
            disposition;
          return {
            ...identity,
            identityCreationSeed:
              identity.identityCreationSeed ??
              identityCreationSeed(0, identity.id),
            disposition,
            relationshipAccounts: {
              ...(identity.relationshipAccounts ?? {}),
              [PLAYER_LEADER_ID]: { ...account },
            },
          };
        }),
      );
    },
  },
];

export async function assertSchemaVersion(
  db: LivingChessDatabase,
): Promise<number> {
  const stored = await db.settings.get('schemaVersion');
  const version = stored === undefined ? SCHEMA_VERSION : Number(stored.value);
  if (version !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version ${version}; expected ${SCHEMA_VERSION}.`,
    );
  }
  return version;
}

export async function stampSchemaVersion(
  db: LivingChessDatabase,
): Promise<void> {
  await db.settings.put({
    key: 'schemaVersion',
    value: String(SCHEMA_VERSION),
  });
}
