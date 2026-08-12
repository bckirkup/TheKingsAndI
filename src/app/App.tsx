import { useState } from 'react';

import { CampaignHub } from './CampaignHub';
import { DebriefScreen } from './DebriefScreen';
import { MatchAuditScreen } from './MatchAuditScreen';
import { MatchScreen } from './MatchScreen';
import { RosterScreen } from './RosterScreen';
import { ThemeProvider } from './ThemeProvider';
import { finalizeCampaignIfComplete } from '../orchestration/campaignFinalize';
import { CareerRepository } from '../persistence';
import type {
  ActRecord,
  CampaignRecord,
  CareerRecord,
  MatchRecord,
  StoredPieceState,
} from '../persistence';
import type { MatchEvent } from '../psychology';

type AppScreen =
  | { readonly kind: 'hub' }
  | {
      readonly kind: 'roster';
      readonly career: CareerRecord;
      readonly act: ActRecord;
      readonly campaign: CampaignRecord;
      readonly roster: StoredPieceState[];
      readonly freeAgents: StoredPieceState[];
      readonly matchIndex: number;
      readonly seed: number;
      readonly leaderAbilityTrust: number;
    }
  | {
      readonly kind: 'match';
      readonly career: CareerRecord;
      readonly act: ActRecord;
      readonly campaign: CampaignRecord;
      readonly roster: StoredPieceState[];
      readonly matchIndex: number;
      readonly seed: number;
      readonly rosterPreamble: readonly MatchEvent[];
    }
  | {
      readonly kind: 'matchAudit';
      readonly match: MatchRecord;
      readonly campaignId: string;
      readonly campaignComplete: boolean;
    }
  | { readonly kind: 'debrief'; readonly campaignId: string };

export function App(): JSX.Element {
  const [screen, setScreen] = useState<AppScreen>({ kind: 'hub' });
  const [repo] = useState(() => new CareerRepository());

  return (
    <ThemeProvider>
      {screen.kind === 'hub' ? (
        <CampaignHub
          onStartMatch={(input) => {
            void (async () => {
              await repo.init();
              const freeAgents = await repo.listFreeAgents();
              setScreen({
                kind: 'roster',
                career: input.career,
                act: input.act,
                campaign: input.campaign,
                roster: input.roster,
                freeAgents,
                matchIndex: input.matchIndex,
                seed: input.seed,
                leaderAbilityTrust: input.leaderAbilityTrust,
              });
            })();
          }}
          onViewDebrief={(campaignId) =>
            setScreen({ kind: 'debrief', campaignId })
          }
        />
      ) : null}

      {screen.kind === 'roster' ? (
        <RosterScreen
          roster={screen.roster}
          freeAgents={screen.freeAgents}
          leaderAbilityTrust={screen.leaderAbilityTrust}
          onBack={() => setScreen({ kind: 'hub' })}
          onConfirm={(roster, preambleEvents) => {
            void (async () => {
              await repo.init();
              await repo.saveRoster(roster);
              setScreen({
                kind: 'match',
                career: screen.career,
                act: screen.act,
                campaign: screen.campaign,
                roster,
                matchIndex: screen.matchIndex,
                seed: screen.seed,
                rosterPreamble: preambleEvents,
              });
            })();
          }}
        />
      ) : null}

      {screen.kind === 'match' ? (
        <MatchScreen
          seed={screen.seed}
          initialRoster={screen.roster}
          opponentArchetype={screen.act.opponentArchetype}
          rosterPreamble={screen.rosterPreamble}
          onMatchFinished={(result) => {
            void (async () => {
              await repo.init();
              const events = [...screen.rosterPreamble, ...result.events];
              const record = await repo.recordMatch({
                campaignId: screen.campaign.id,
                actId: screen.act.id,
                matchIndex: screen.matchIndex,
                seed: screen.seed,
                rosterSnapshot: screen.roster,
                rosterEnd: result.rosterEnd,
                events,
                engineAudit: result.engineAudit,
                result: result.result,
              });
              const matches = await repo.listMatches(screen.campaign.id);
              const act = await repo.getAct(screen.act.id);
              const finalized =
                act === undefined
                  ? null
                  : finalizeCampaignIfComplete({
                      matches,
                      campaignTarget: screen.campaign.targetMatches,
                      kingsRemaining: act.kingsRemaining,
                    });
              if (finalized !== null) {
                await repo.updateCampaignTerminal({
                  actId: screen.act.id,
                  careerId: screen.career.id,
                  terminalState: finalized.terminal,
                  careerOutcome: finalized.outcome,
                });
              }
              const campaignComplete =
                matches.length >= screen.campaign.targetMatches;
              setScreen({
                kind: 'matchAudit',
                match: record,
                campaignId: screen.campaign.id,
                campaignComplete,
              });
            })();
          }}
        />
      ) : null}

      {screen.kind === 'matchAudit' ? (
        <MatchAuditScreen
          match={screen.match}
          onContinue={() => {
            if (screen.campaignComplete) {
              setScreen({ kind: 'debrief', campaignId: screen.campaignId });
            } else {
              setScreen({ kind: 'hub' });
            }
          }}
        />
      ) : null}

      {screen.kind === 'debrief' ? (
        <DebriefScreen
          campaignId={screen.campaignId}
          onBack={() => setScreen({ kind: 'hub' })}
        />
      ) : null}
    </ThemeProvider>
  );
}
