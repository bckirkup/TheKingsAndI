import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { canonicalJson } from '../src/core/canonicalJson';
import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';

import { containmentReport } from './containment';
import { createSimEngine, type SimEngineKind } from './engine';
import type { JournalEntry } from './journal';
import { scriptedAgent } from './journal';
import type { Leader } from './cli';
import { LEADERS } from './cli';
import { personaAgent, PERSONAS, type PersonaName } from './personas';
import { createStartingRoster } from './roster';
import { runMatch } from './match';

/**
 * Containment sweep (ADR 0079 step 2): run one persona through matches
 * against a scripted opponent while every leader-seat ask is scored against
 * the full NPC style envelope. The journal carries `envelope` per entry, so
 * containment is computed from the journal alone — never a second run.
 *
 * Usage: node --import tsx sim/containmentCli.ts --persona=disengaged \
 *   --matches=2 --seed=7 --engine=fake [--journal=out.json]
 */

interface ContainmentOptions {
  readonly persona: PersonaName;
  readonly matches: number;
  readonly seed: number;
  readonly leader: Leader;
  readonly opponent: Leader;
  readonly engine: SimEngineKind;
  readonly journal: string | undefined;
}

function parseArguments(argv: readonly string[]): ContainmentOptions {
  const values = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument "${arg}".`);
    }
    const eq = arg.indexOf('=');
    if (eq < 0) throw new Error(`Expected --flag=value, got "${arg}".`);
    values.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const persona = values.get('persona');
  if (!PERSONAS.includes(persona as PersonaName)) {
    throw new Error(
      `--persona must be one of ${PERSONAS.join(', ')} (got "${persona ?? 'unset'}").`,
    );
  }
  const leader = (values.get('leader') ?? 'tyrannical') as Leader;
  const opponent = (values.get('opponent') ?? 'tyrannical') as Leader;
  if (!LEADERS.includes(leader) || !LEADERS.includes(opponent)) {
    throw new Error(`--leader/--opponent must be one of ${LEADERS.join(', ')}.`);
  }
  return {
    persona: persona as PersonaName,
    matches: Number.parseInt(values.get('matches') ?? '2', 10),
    seed: Number.parseInt(values.get('seed') ?? '7', 10),
    leader,
    opponent,
    engine: (values.get('engine') ?? 'fake') as SimEngineKind,
    journal: values.get('journal'),
  };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const engine = await createSimEngine(options.engine);
  const agent = personaAgent(options.persona);
  const journal: JournalEntry[] = [];
  const board = LivingBoard.standard();
  for (let matchIndex = 1; matchIndex <= options.matches; matchIndex += 1) {
    const seed = options.seed + matchIndex * 10_007;
    const random = createSeededRandom(seed);
    const roster = createStartingRoster(
      board,
      'w',
      20,
      random.nextInt(10_000) / 10_000,
    );
    const enemyRoster = createStartingRoster(
      board,
      'b',
      20,
      random.nextInt(10_000) / 10_000,
    );
    await runMatch({
      seed,
      leader: options.leader,
      matchIndex,
      campaignMatch: matchIndex,
      roster,
      enemyRoster,
      opponent: options.opponent,
      engine,
      journalEntries: journal,
      leaderJournalAgent: agent,
      opponentJournalAgent: scriptedAgent('scripted:opponent'),
      envelopeStyles: LEADERS,
    });
  }
  const report = containmentReport(journal);
  const move = report.perKind.move;
  const override = report.perKind.override;
  console.log(
    `containment persona=${options.persona} matches=${options.matches} ` +
      `decisions=${report.decisionCount} scored=${report.scoredDecisions} ` +
      `move.ooe=${move.outOfEnvelopeRate.toFixed(3)} ` +
      `move.d2=${move.distance2Count} ` +
      `override.ooe=${override.outOfEnvelopeRate.toFixed(3)} ` +
      `uncoveredDisengage=${report.uncoveredDisengageCount}` +
      (report.firstUncoveredDisengageIndex === undefined
        ? ''
        : ` first@${report.firstUncoveredDisengageIndex}`),
  );
  if (options.journal !== undefined) {
    await mkdir(dirname(options.journal), { recursive: true });
    await writeFile(
      options.journal,
      `${canonicalJson({ persona: agent.identity, entries: journal, report })}\n`,
      'utf8',
    );
  }
}

await main();
