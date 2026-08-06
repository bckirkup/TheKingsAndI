import { useEffect, useState } from 'react';

import { bootstrapRoster } from './careerBootstrap';
import { CareerRepository } from '../persistence';
import type {
  CampaignRecord,
  CareerRecord,
  StoredPieceState,
} from '../persistence';

export interface CampaignHubProps {
  readonly onStartMatch: (input: {
    readonly career: CareerRecord;
    readonly campaign: CampaignRecord;
    readonly roster: StoredPieceState[];
    readonly matchIndex: number;
    readonly seed: number;
  }) => void;
  readonly onViewDebrief: (campaignId: string) => void;
}

export function CampaignHub({
  onStartMatch,
  onViewDebrief,
}: CampaignHubProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [career, setCareer] = useState<CareerRecord | null>(null);
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [roster, setRoster] = useState<StoredPieceState[]>([]);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    const repo = new CareerRepository();
    void (async () => {
      await repo.init();
      const existing = await repo.loadActiveCampaign();
      if (existing !== null) {
        setCareer(existing.career);
        setCampaign(existing.campaign);
        setRoster(existing.roster);
        setMatchCount(existing.matchCount);
        setLoading(false);
        return;
      }

      const { roster: freshRoster, identities } = bootstrapRoster(42);
      const created = await repo.createCareer({
        seed: 42,
        roster: freshRoster,
        identities,
        targetMatches: 5,
      });
      setCareer(created.career);
      setCampaign(created.campaign);
      setRoster(created.roster);
      setMatchCount(0);
      setLoading(false);
    })();
  }, []);

  if (loading || career === null || campaign === null) {
    return <p>Loading campaign…</p>;
  }

  const campaignComplete = matchCount >= campaign.targetMatches;

  return (
    <section className="campaign-hub">
      <h1>Campaign</h1>
      <p>
        Act 1 · King {campaign.actId.slice(-6)} · Match {matchCount}/
        {campaign.targetMatches}
      </p>
      <p className="campaign-hub__note">
        Career seed {career.seed}. Roster carries trust and trauma between
        matches.
      </p>
      <div className="campaign-hub__actions">
        {!campaignComplete ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              onStartMatch({
                career,
                campaign,
                roster,
                matchIndex: matchCount + 1,
                seed: career.seed ^ ((matchCount + 1) * 1_000_003),
              });
            }}
          >
            {matchCount === 0 ? 'Begin first match' : 'Play next match'}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => onViewDebrief(campaign.id)}
          >
            View campaign debrief
          </button>
        )}
      </div>
    </section>
  );
}
