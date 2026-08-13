import { useEffect, useState } from 'react';

import { bootstrapRoster } from './careerBootstrap';
import { CAMPAIGN_CONFIG } from '../orchestration/campaignConfig';
import {
  evaluateReinstatement,
  leaderAbilityTrustFromMatches,
} from '../orchestration/campaignPolicy';
import { CareerRepository } from '../persistence';
import type {
  ActRecord,
  CampaignRecord,
  CareerRecord,
  StoredPieceState,
} from '../persistence';

export interface CampaignHubProps {
  readonly onStartMatch: (input: {
    readonly career: CareerRecord;
    readonly act: ActRecord;
    readonly campaign: CampaignRecord;
    readonly roster: StoredPieceState[];
    readonly matchIndex: number;
    readonly seed: number;
    readonly leaderAbilityTrust: number;
  }) => void;
  readonly onViewDebrief: (campaignId: string) => void;
}

export function CampaignHub({
  onStartMatch,
  onViewDebrief,
}: CampaignHubProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [career, setCareer] = useState<CareerRecord | null>(null);
  const [act, setAct] = useState<ActRecord | null>(null);
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [roster, setRoster] = useState<StoredPieceState[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [targetMatches, setTargetMatches] = useState<number>(
    CAMPAIGN_CONFIG.MIN_CAMPAIGN_MATCHES,
  );
  const [reinstatementOffered, setReinstatementOffered] = useState(false);

  useEffect(() => {
    const repo = new CareerRepository();
    void (async () => {
      await repo.init();
      const existing = await repo.loadActiveCampaign();
      if (existing !== null) {
        setCareer(existing.career);
        setAct(existing.act);
        setCampaign(existing.campaign);
        setRoster(existing.roster);
        setMatchCount(existing.matchCount);
        setTargetMatches(existing.campaign.targetMatches);
        const matches = await repo.listMatches(existing.campaign.id);
        const lastMatch = matches.at(-1);
        if (
          existing.act.playerSuspended &&
          lastMatch !== undefined &&
          evaluateReinstatement(existing.roster, lastMatch.audit.meanTrustDelta)
        ) {
          setReinstatementOffered(true);
        }
        setLoading(false);
        return;
      }

      const { roster: freshRoster, identities } = bootstrapRoster(42);
      const created = await repo.createCareer({
        seed: 42,
        roster: freshRoster,
        identities,
        targetMatches,
      });
      setCareer(created.career);
      setAct(created.act);
      setCampaign(created.campaign);
      setRoster(created.roster);
      setMatchCount(0);
      setLoading(false);
    })();
  }, []);

  if (loading || career === null || campaign === null || act === null) {
    return <p>Loading campaign…</p>;
  }

  const campaignComplete = matchCount >= campaign.targetMatches;
  const matchesPromise = new CareerRepository();

  return (
    <section className="campaign-hub">
      <h1>Campaign</h1>
      <p>
        Act 1 · Kings remaining {act.kingsRemaining} · Match {matchCount}/
        {campaign.targetMatches}
      </p>
      <p className="campaign-hub__note">
        Opponent: {act.opponentArchetype} commander. Career seed {career.seed}.
      </p>

      {matchCount === 0 ? (
        <label className="campaign-hub__length">
          Campaign length{' '}
          <select
            value={targetMatches}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              setTargetMatches(next);
              void (async () => {
                const repo = new CareerRepository();
                await repo.init();
                await repo.updateCampaignTarget(campaign.id, next);
                setCampaign({ ...campaign, targetMatches: next });
              })();
            }}
          >
            {Array.from(
              {
                length:
                  CAMPAIGN_CONFIG.MAX_CAMPAIGN_MATCHES -
                  CAMPAIGN_CONFIG.MIN_CAMPAIGN_MATCHES +
                  1,
              },
              (_, index) => CAMPAIGN_CONFIG.MIN_CAMPAIGN_MATCHES + index,
            ).map((count) => (
              <option key={count} value={count}>
                {count} matches
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {reinstatementOffered ? (
        <div className="campaign-hub__reinstatement">
          <p>
            The King offers reinstatement. Trust has recovered enough to compare
            your command against his.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void (async () => {
                const repo = new CareerRepository();
                await repo.init();
                await repo.reinstatePlayer(act.id);
                setReinstatementOffered(false);
                setAct({ ...act, playerSuspended: false });
              })();
            }}
          >
            Accept reinstatement
          </button>
        </div>
      ) : null}

      {act.playerSuspended && !reinstatementOffered ? (
        <p className="campaign-hub__suspended">
          You remain suspended after dismissal. The King commands until
          reinstatement is earned.
        </p>
      ) : null}

      <div className="campaign-hub__actions">
        {!campaignComplete ? (
          <button
            type="button"
            className="btn"
            disabled={act.playerSuspended && !reinstatementOffered}
            onClick={() => {
              void (async () => {
                const repo = matchesPromise;
                await repo.init();
                const matches = await repo.listMatches(campaign.id);
                const leaderAbilityTrust =
                  leaderAbilityTrustFromMatches(matches);
                onStartMatch({
                  career,
                  act,
                  campaign,
                  roster,
                  matchIndex: matchCount + 1,
                  seed: career.seed ^ ((matchCount + 1) * 1_000_003),
                  leaderAbilityTrust,
                });
              })();
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
