import { describe, expect, it } from 'vitest';

import { parseArguments, renderCsv, runSimulation } from '../sim/cli';
import { detectDegeneracy } from '../sim/degeneracy';
import { aggregateCampaign } from '../sim/metrics';

describe('simulation harness golden output', () => {
  it('renders a fixed CSV for a fixed configuration', async () => {
    const csv = renderCsv(
      await runSimulation({
        matches: 2,
        leader: 'tyrannical',
        seed: 7,
        engineKind: 'fake',
      }),
    );
    expect(csv).toBe(
      [
        'match,seed,leader,plies,refusals,overrides,quiet_quit_moves,desertions,cascade_length,refused_good_moves,refusal_rate,quiet_quit_rate,refused_good_move_rate,override_rate,mean_trust_start,mean_trust_end,class_contempt_start,class_contempt_end,win_score,rout,archetype',
        '1,1000004,tyrannical,179,17,80,0,2,1,10,0.0950,0.0000,0.5882,0.4469,-10.00,-67.78,-20.00,-16.67,0,0,tyrant',
        '2,2000001,tyrannical,146,12,61,0,13,10,5,0.0822,0.0000,0.4167,0.4178,-42.50,-100.00,-20.00,-5.00,50,1,tyrant',
        '',
      ].join('\n'),
    );
  });

  it('is byte-identical when repeated with the same seed', async () => {
    const options = {
      matches: 4,
      leader: 'supportive' as const,
      seed: 12,
      engineKind: 'fake' as const,
    };
    expect(renderCsv(await runSimulation(options))).toBe(
      renderCsv(await runSimulation(options)),
    );
  });
});

describe('simulation harness sensitivity', () => {
  it('changes output when seed changes', async () => {
    expect(
      renderCsv(
        await runSimulation({
          matches: 2,
          leader: 'random',
          seed: 1,
          engineKind: 'fake',
        }),
      ),
    ).not.toBe(
      renderCsv(
        await runSimulation({
          matches: 2,
          leader: 'random',
          seed: 2,
          engineKind: 'fake',
        }),
      ),
    );
  });

  it('changes output when leader changes', async () => {
    expect(
      renderCsv(
        await runSimulation({
          matches: 2,
          leader: 'random',
          seed: 1,
          engineKind: 'fake',
        }),
      ),
    ).not.toBe(
      renderCsv(
        await runSimulation({
          matches: 2,
          leader: 'redeemer',
          seed: 1,
          engineKind: 'fake',
        }),
      ),
    );
  });
});

describe('simulation harness argument parsing', () => {
  it('accepts the explicit equals form', () => {
    expect(
      parseArguments([
        '--matches=20',
        '--leader=tyrannical',
        '--seed=7',
        '--campaign=20',
        '--out=metrics.csv',
      ]),
    ).toEqual({
      matches: 20,
      campaign: 20,
      leader: 'tyrannical',
      seed: 7,
      engine: 'fake',
      out: 'metrics.csv',
    });
  });

  it.each([
    ['--unknown=value', 'Unrecognised flag'],
    ['--matches', 'Expected --flag=value form'],
    ['--matches=2', 'Repeated flag'],
  ])('rejects malformed or repeated flags', (argument, message) => {
    const argumentsList =
      argument === '--matches=2' ? ['--matches=1', argument] : [argument];
    expect(() => parseArguments(argumentsList)).toThrow(message);
  });

  it('rejects the space-separated flag form', () => {
    expect(() => parseArguments(['--matches', '20'])).toThrow(
      'Expected --flag=value form',
    );
  });
});

describe('degeneracy detectors', () => {
  it('flags tyrannical campaigns with no desertions', async () => {
    const metrics = await runSimulation({
      matches: 1,
      leader: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
    });
    const summary = aggregateCampaign('tyrannical', 7, metrics);
    const findings = detectDegeneracy('tyrannical', metrics, {
      ...summary,
      desertionCampaignRate: 0,
      meanRefusalRate: 0.1,
    });
    expect(findings.some((finding) => finding.code === 'no-rout')).toBe(true);
  });
});
