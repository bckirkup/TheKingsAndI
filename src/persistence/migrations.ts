import type { LivingChessDatabase } from './db';
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
