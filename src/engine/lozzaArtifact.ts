/**
 * Identity of the vendored `vendor/lozza/lozza.cjs` artifact, committed so the
 * browser worker port (`workerLozza.ts`) computes the same `determinismId` as
 * the Node adapter without filesystem access. The Node adapter still hashes
 * the real file; `tests/engine.lozzaArtifact.test.ts` recomputes both fields
 * from the artifact and fails if the vendored file drifts from these values.
 */
export const LOZZA_ARTIFACT_BUILD = '11';
export const LOZZA_ARTIFACT_SHA256 = '1fa7aed08e7e';
