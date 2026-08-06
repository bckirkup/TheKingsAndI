import { describe, expect, it } from 'vitest';

import { parseArguments, renderCsv, runSimulation } from '../sim/cli';
import { detectDegeneracy } from '../sim/degeneracy';
import { aggregateCampaign } from '../sim/metrics';

describe('simulation harness golden output', () => {
  it('renders a fixed CSV for a fixed configuration', () => {
    const csv = renderCsv(
      runSimulation({ matches: 2, leader: 'tyrannical', seed: 7 }),
    );
    expect(csv).toBe(
      [
        'match,seed,leader,plies,refusals,overrides,quiet_quit_moves,desertions,cascade_length,refused_good_moves,refusal_rate,quiet_quit_rate,refused_good_move_rate,override_rate,mean_trust_start,mean_trust_end,class_contempt_start,class_contempt_end,win_score,rout,archetype',
        '1,1000004,tyrannical,156,12,64,2,13,4,1,0.0769,0.0128,0.0833,0.4103,-10.00,-100.00,-20.00,-5.00,50,1,tyrant',
        '2,2000001,tyrannical,101,10,39,0,14,5,2,0.0990,0.0000,0.2000,0.3861,-15.63,-100.00,-20.00,-5.00,50,1,tyrant',
        '',
      ].join('\n'),
    );
  });

  it('is byte-identical when repeated with the same seed', () => {
    const options = { matches: 4, leader: 'supportive' as const, seed: 12 };
    expect(renderCsv(runSimulation(options))).toBe(
      renderCsv(runSimulation(options)),
    );
  });
});

describe('simulation harness sensitivity', () => {
  it('changes output when seed changes', () => {
    expect(
      renderCsv(runSimulation({ matches: 2, leader: 'random', seed: 1 })),
    ).not.toBe(
      renderCsv(runSimulation({ matches: 2, leader: 'random', seed: 2 })),
    );
  });

  it('changes output when leader changes', () => {
    expect(
      renderCsv(runSimulation({ matches: 2, leader: 'random', seed: 1 })),
    ).not.toBe(
      renderCsv(runSimulation({ matches: 2, leader: 'redeemer', seed: 1 })),
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
  it('flags tyrannical campaigns with no desertions', () => {
    const metrics = runSimulation({
      matches: 1,
      leader: 'tyrannical',
      seed: 7,
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
