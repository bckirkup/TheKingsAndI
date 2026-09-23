import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createStartingRoster } from '../src/orchestration/roster';
import {
  projectMoveObservation,
  projectOwnRosterObservation,
} from '../src/orchestration/observation';

const UI_ROOT = join(process.cwd(), 'src/ui');

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }
    if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      files.push(path);
    }
  }
  return files;
}

describe('glass screen (D219 / ADR 0079)', () => {
  it('forbids PieceState imports under src/ui/', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(UI_ROOT)) {
      const source = readFileSync(file, 'utf8');
      if (
        /\bPieceState\b/.test(source) &&
        /from\s+['"][^'"]*psychology/.test(source)
      ) {
        offenders.push(relative(process.cwd(), file));
      }
      if (
        /\bimport\s+type\s*\{[^}]*\bPieceState\b/.test(source) ||
        /\bimport\s*\{[^}]*\bPieceState\b/.test(source)
      ) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('projects affinity and class heat as band words only', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', -40, 0.5);
    const observed = projectOwnRosterObservation({
      board,
      side: 'w',
      roster,
    });
    expect(observed.length).toBeGreaterThan(0);
    for (const piece of observed) {
      expect(typeof piece.trust).toBe('string');
      expect(typeof piece.morale).toBe('string');
      expect(typeof piece.trauma).toBe('string');
      expect(piece.affinities.length).toBe(observed.length - 1);
      for (const edge of piece.affinities) {
        expect(['cold', 'neutral', 'warm']).toContain(edge.heat);
      }
      expect(piece.classHeat).toHaveLength(6);
      for (const cell of piece.classHeat) {
        expect(['cold', 'neutral', 'warm']).toContain(cell.heat);
      }
    }
    const move = projectMoveObservation({
      board,
      side: 'w',
      ply: 1,
      roster,
    });
    expect(JSON.stringify(move)).not.toMatch(/"T_i"|"M_i"|"B_i"|"E_i"/);
    expect(JSON.stringify(move)).not.toContain('dyadicAffinity');
    expect(JSON.stringify(move)).not.toContain('classPrestige');
  });
});
