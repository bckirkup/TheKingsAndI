import { useEffect, useState } from 'react';

import { campaignDebriefProse, type NarratedOutcome } from '../narrative';
import { CareerRepository } from '../persistence';
import type { CampaignDebrief, MatchResult } from '../persistence';
import { certificateToJson } from '../persistence/certificate';
import { EPILOGUE_BY_TERMINAL } from '../orchestration/terminalState';
import { ENGINE_CONFIG } from '../psychology';
import { DebriefBarChart } from '../ui/panels/DebriefChart';

const OUTCOME_BY_RESULT: Readonly<Record<MatchResult, NarratedOutcome>> = {
  WIN: 'WIN',
  LOSS: 'LOSS',
  DRAW: 'DRAW',
  ROUT: 'ROUT',
  DISMISSED: 'DISMISSED',
  ABANDONED: 'ABANDONED',
};

export interface DebriefScreenProps {
  readonly campaignId: string;
  readonly onBack: () => void;
}

export function DebriefScreen({
  campaignId,
  onBack,
}: DebriefScreenProps): JSX.Element {
  const [debrief, setDebrief] = useState<CampaignDebrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repo = new CareerRepository();
    void (async () => {
      await repo.init();
      try {
        setDebrief(await repo.buildDebrief(campaignId));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Debrief failed.');
      }
    })();
  }, [campaignId]);

  if (error !== null) return <p>{error}</p>;
  if (debrief === null) return <p>Computing debrief…</p>;

  const { transcript } = debrief;

  const prose = campaignDebriefProse({
    matches: debrief.matches.map((match) => ({
      result: OUTCOME_BY_RESULT[match.result],
      executionFidelity: match.audit.executionFidelity,
    })),
    tauAbilTrajectory: transcript.tauAbilTrajectory,
    tauBenevTrajectory: transcript.tauBenevTrajectory,
    attrition: transcript.attrition,
    traumaGini: transcript.traumaGini,
  });
  const weights = ENGINE_CONFIG.LEADERSHIP_WEIGHTS;
  const loyaltyContribution =
    debrief.judgementSeat.meanFinalTrust === null
      ? null
      : weights.alpha * debrief.judgementSeat.meanFinalTrust;
  const crownContribution =
    debrief.judgementSeat.meanWinScore === null
      ? null
      : weights.beta * debrief.judgementSeat.meanWinScore;
  const traumaContribution =
    debrief.judgementSeat.meanUnjustifiedTrauma === null
      ? null
      : -weights.gamma * debrief.judgementSeat.meanUnjustifiedTrauma;
  const quietQuitContribution =
    debrief.judgementSeat.meanQuietQuitTurns === null
      ? null
      : -weights.delta * debrief.judgementSeat.meanQuietQuitTurns;
  const emptiedChairsContribution =
    debrief.judgementSeat.meanEmptiedChairsScore === null
      ? null
      : -weights.epsilon * debrief.judgementSeat.meanEmptiedChairsScore;

  return (
    <section className="debrief-screen">
      <h1>Campaign debrief</h1>
      <p>{EPILOGUE_BY_TERMINAL[debrief.actTerminalState]}</p>

      <section className="debrief-screen__judgement-seat">
        <h2>The Judgement Seat</h2>
        <dl className="debrief-screen__folds">
          <div>
            <dt>Loyalty earned unobserved (0.4·T_final)</dt>
            <dd>
              {loyaltyContribution === null
                ? 'Not computable'
                : loyaltyContribution.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt>The crown&apos;s reward (0.3·win score)</dt>
            <dd>
              {crownContribution === null
                ? 'Not computable'
                : crownContribution.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt>Unjustified trauma charged (−0.2·UT)</dt>
            <dd>
              {traumaContribution === null
                ? 'Not computable'
                : traumaContribution.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt>Quiet-quit turns charged (−0.1·QQ)</dt>
            <dd>
              {quietQuitContribution === null
                ? 'Not computable'
                : quietQuitContribution.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt>The emptied chairs (−ε·EC, ε=0)</dt>
            <dd>
              {emptiedChairsContribution === null
                ? 'Not computable'
                : emptiedChairsContribution.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt>Leadership Index</dt>
            <dd>
              {debrief.judgementSeat.meanLeadershipIndex === null
                ? 'Not computable'
                : debrief.judgementSeat.meanLeadershipIndex.toFixed(1)}
            </dd>
          </div>
        </dl>
        {debrief.judgementSeat.computedMatchCount <
        debrief.judgementSeat.totalMatchCount ? (
          <p className="debrief-screen__judgement-seat-note">
            computed over {debrief.judgementSeat.computedMatchCount} of{' '}
            {debrief.judgementSeat.totalMatchCount} matches
          </p>
        ) : null}
      </section>

      <div className="narration-audit">
        <h2 className="narration-audit__headline">{prose.headline}</h2>
        {prose.paragraphs.map((paragraph) => (
          <p key={paragraph} className="narration-audit__paragraph">
            {paragraph}
          </p>
        ))}
        <ul className="narration-audit__findings">
          {prose.findings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      </div>

      <DebriefBarChart matches={debrief.matches} />

      <table className="debrief-screen__table">
        <thead>
          <tr>
            <th>Match</th>
            <th>Board quality</th>
            <th>Realized quality</th>
            <th>Execution fidelity</th>
            <th>Gap</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {debrief.matches.map((match) => (
            <tr key={match.id}>
              <td>{match.matchIndex}</td>
              <td>{match.audit.boardQuality.toFixed(1)}</td>
              <td>{match.audit.realizedQuality.toFixed(1)}</td>
              <td>{(match.audit.executionFidelity * 100).toFixed(0)}%</td>
              <td>
                {(
                  match.audit.boardQuality -
                  match.audit.executionFidelity * 100
                ).toFixed(1)}
              </td>
              <td>{match.result}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Transcript (ADR 0030)</h2>
      <dl className="debrief-screen__folds">
        <div>
          <dt>Quality gap</dt>
          <dd>{transcript.qualityGap.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Concessions (good moves withdrawn)</dt>
          <dd>{transcript.concessionCount}</dd>
        </div>
        <div>
          <dt>Trauma Gini</dt>
          <dd>{transcript.traumaGini.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Overrides</dt>
          <dd>{transcript.overrideLedger.length}</dd>
        </div>
        <div>
          <dt>Attrition (desert / refuse / fire)</dt>
          <dd>
            {transcript.attrition.desertions} / {transcript.attrition.refusals}{' '}
            / {transcript.attrition.firings}
          </dd>
        </div>
      </dl>

      <h2>Campaign folds</h2>
      <dl className="debrief-screen__folds">
        <div>
          <dt>Mean board quality</dt>
          <dd>{debrief.meanBoardQuality.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Mean realized quality</dt>
          <dd>{debrief.meanRealizedQuality.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Mean execution fidelity</dt>
          <dd>{(debrief.meanExecutionFidelity * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt>Trust delta (longitudinal)</dt>
          <dd>
            {debrief.cultureDrift.deltaAverageTrustLongitudinal.toFixed(1)}
          </dd>
        </div>
        <div>
          <dt>Cross-class prestige shift</dt>
          <dd>{debrief.cultureDrift.crossClassPrestigeShift.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Burnout index</dt>
          <dd>{debrief.cultureDrift.burnoutIndex.toFixed(1)}</dd>
        </div>
      </dl>

      <div className="campaign-hub__actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            void (async () => {
              const repo = new CareerRepository();
              await repo.init();
              const bundle = await repo.buildCertificate(campaignId);
              const blob = new Blob([certificateToJson(bundle)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `certificate-${campaignId}.json`;
              anchor.click();
              URL.revokeObjectURL(url);
            })();
          }}
        >
          Download certificate bundle
        </button>
        <button type="button" className="btn" onClick={onBack}>
          Back to campaign
        </button>
      </div>
    </section>
  );
}
