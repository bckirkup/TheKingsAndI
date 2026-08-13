import { digest } from '../core/digest';

import { buildCampaignDebrief } from './folds';
import { foldCampaignTranscript } from './transcript';
import type { CareerRecord, CertificateBundle, MatchRecord } from './types';
export type { CampaignDebrief, CampaignTranscript } from './types';
import { CERTIFICATE_VERSION } from './types';

export function buildCertificateBundle(input: {
  readonly career: CareerRecord;
  readonly campaignId: string;
  readonly matches: readonly MatchRecord[];
  readonly initialRoster: readonly import('./types').StoredPieceState[];
  readonly finalRoster: readonly import('./types').StoredPieceState[];
  readonly actTerminalState: import('./types').ActTerminalState;
}): CertificateBundle {
  const debrief = buildCampaignDebrief(
    input.campaignId,
    input.matches,
    input.initialRoster,
    input.finalRoster,
    input.actTerminalState,
  );
  const transcript = foldCampaignTranscript(input.matches);
  const payload = {
    version: CERTIFICATE_VERSION,
    careerId: input.career.id,
    campaignId: input.campaignId,
    seed: input.career.seed,
    determinismId: input.matches[0]?.determinismId ?? 'unknown',
    matches: input.matches,
    debrief,
    transcript,
  };
  return {
    ...payload,
    contentDigest: digest(payload),
  };
}

export function certificateToJson(bundle: CertificateBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function verifyCertificateDigest(bundle: CertificateBundle): boolean {
  const { contentDigest, ...payload } = bundle;
  void contentDigest;
  return digest(payload) === bundle.contentDigest;
}
