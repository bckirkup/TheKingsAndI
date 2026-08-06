import { useState } from 'react';

import { CampaignHub } from './CampaignHub';
import { DebriefScreen } from './DebriefScreen';
import { MatchScreen } from './MatchScreen';
import { RosterScreen } from './RosterScreen';
import { ThemeProvider } from './ThemeProvider';
import { CareerRepository } from '../persistence';
import type {
  CampaignRecord,
  CareerRecord,
  StoredPieceState,
} from '../persistence';

type AppScreen =
  | { readonly kind: 'hub' }
  | {
      readonly kind: 'roster';
      readonly career: CareerRecord;
      readonly campaign: CampaignRecord;
      readonly roster: StoredPieceState[];
      readonly matchIndex: number;
      readonly seed: number;
    }
  | {
      readonly kind: 'match';
      readonly career: CareerRecord;
      readonly campaign: CampaignRecord;
      readonly roster: StoredPieceState[];
      readonly matchIndex: number;
      readonly seed: number;
    }
  | { readonly kind: 'debrief'; readonly campaignId: string };

export function App(): JSX.Element {
  const [screen, setScreen] = useState<AppScreen>({ kind: 'hub' });
  const [repo] = useState(() => new CareerRepository());

  return (
    <ThemeProvider>
      {screen.kind === 'hub' ? (
        <CampaignHub
          onStartMatch={(input) =>
            setScreen({
              kind: 'roster',
              career: input.career,
              campaign: input.campaign,
              roster: input.roster,
              matchIndex: input.matchIndex,
              seed: input.seed,
            })
          }
          onViewDebrief={(campaignId) =>
            setScreen({ kind: 'debrief', campaignId })
          }
        />
      ) : null}

      {screen.kind === 'roster' ? (
        <RosterScreen
          roster={screen.roster}
          onBack={() => setScreen({ kind: 'hub' })}
          onConfirm={(roster) => {
            void (async () => {
              await repo.init();
              await repo.saveRoster(roster);
              setScreen({
                kind: 'match',
                career: screen.career,
                campaign: screen.campaign,
                roster,
                matchIndex: screen.matchIndex,
                seed: screen.seed,
              });
            })();
          }}
        />
      ) : null}

      {screen.kind === 'match' ? (
        <MatchScreen
          seed={screen.seed}
          initialRoster={screen.roster}
          onMatchFinished={(result) => {
            void (async () => {
              await repo.init();
              await repo.recordMatch({
                campaignId: screen.campaign.id,
                actId: screen.career.actIds[0] ?? screen.campaign.actId,
                matchIndex: screen.matchIndex,
                seed: screen.seed,
                rosterSnapshot: screen.roster,
                rosterEnd: result.rosterEnd,
                events: result.events,
                result: result.result,
              });
              setScreen({ kind: 'hub' });
            })();
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
