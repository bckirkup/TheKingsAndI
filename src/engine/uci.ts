import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

/**
 * Minimal UCI client for depth-limited search (ADR 0005). No movetime, no
 * wall-clock cutoffs — only `go depth N`.
 */

export interface UciSearchResult {
  readonly scoreCp: number;
  readonly pv: readonly string[];
  readonly sound: boolean;
  readonly rawScore: string;
}

export const MAX_PLAUSIBLE_MATE_DISTANCE = 100;
// Honest material cannot reach 200 pawns; larger values are mate-band leakage.
export const MAX_PLAUSIBLE_CENTIPAWNS = 20_000;
export const DEFAULT_MAX_SCORE_ESCALATIONS = 4;
// Real adapter searches at depth 4 with MultiPV 8 emit at most 22 lines
// across the measured mid-game positions; 512 leaves over 20x headroom.
export const DEFAULT_MAX_INFO_LINES_PER_SEARCH = 512;

export interface UciEngineOptions {
  /** Absolute path to the engine script (e.g. lozza.cjs or stockfish-*.js). */
  readonly enginePath: string;
  /** Clear carried engine state before every search; defaults to cold. */
  readonly coldSearch?: boolean;
  /** Fixed hash size in MiB (deterministic mode). */
  readonly hashMb?: number;
  /** Must stay 1 for determinism (ADR 0005). */
  readonly threads?: number;
  /** MultiPV count for shared-search trees (ADR 0017). */
  readonly multiPv?: number;
  /** Maximum deterministic one-ply re-searches for unsound scores. */
  readonly maxScoreEscalations?: number;
  /** Hard ceiling on info lines emitted by one search. */
  readonly maxInfoLinesPerSearch?: number;
}

export class UciEngineExitedError extends Error {
  constructor(
    readonly code: number | null,
    readonly signal: NodeJS.Signals | null,
    readonly stderr: string,
    readonly fen: string | undefined,
    readonly depth: number | undefined,
  ) {
    const status =
      code === null ? `signal ${signal ?? 'unknown'}` : `code ${code}`;
    const tail = stderr.length === 0 ? '' : `; stderr: ${stderr}`;
    const request =
      fen === undefined || depth === undefined
        ? ''
        : ` at depth ${depth} for FEN ${fen}`;
    super(`Engine child exited with ${status}${request}${tail}`);
    this.name = 'UciEngineExitedError';
  }
}

export class UciUnsoundScoreError extends Error {
  constructor(
    readonly fen: string,
    readonly requestedDepth: number,
    readonly rawScore: string,
    readonly escalations: number,
  ) {
    super(
      `Unsound engine score ${rawScore} for FEN ${fen} at requested depth ` +
        `${requestedDepth} after ${escalations} score escalations`,
    );
    this.name = 'UciUnsoundScoreError';
  }
}

export class UciInfoLineLimitError extends Error {
  constructor(
    readonly fen: string,
    readonly requestedDepth: number,
    readonly count: number,
  ) {
    super(
      `Engine exceeded the info-line limit for FEN ${fen} at depth ` +
        `${requestedDepth}: ${count} lines`,
    );
    this.name = 'UciInfoLineLimitError';
  }
}

/** Per-depth principal line captured from a single `go depth N` search. */
export interface DepthLadder {
  readonly maxDepth: number;
  readonly at: ReadonlyMap<number, UciSearchResult>;
  /** MultiPV lines retained at each emitted depth (depth → multipv → result). */
  readonly multiPvAt: ReadonlyMap<number, ReadonlyMap<number, UciSearchResult>>;
  /** MultiPV lines at `maxDepth` (1-indexed multipv → result). */
  readonly multiPvAtMax: ReadonlyMap<number, UciSearchResult>;
}

export function isUnsoundUciScore(kind: 'cp' | 'mate', value: number): boolean {
  return kind === 'mate'
    ? value === 0 || Math.abs(value) > MAX_PLAUSIBLE_MATE_DISTANCE
    : Math.abs(value) >= MAX_PLAUSIBLE_CENTIPAWNS;
}

export function parseUciScore(tokens: readonly string[]): {
  readonly scoreCp: number;
  readonly sound: boolean;
  readonly rawScore: string;
} {
  const scoreIndex = tokens.indexOf('score');
  if (scoreIndex < 0) {
    throw new Error(`UCI info line missing score: ${tokens.join(' ')}`);
  }
  const kind = tokens[scoreIndex + 1];
  const value = tokens[scoreIndex + 2];
  if (kind === undefined || value === undefined) {
    throw new Error(`Malformed UCI score: ${tokens.join(' ')}`);
  }
  if (kind === 'cp') {
    const cp = Number(value);
    if (!Number.isSafeInteger(cp)) {
      throw new TypeError(`Non-integer centipawn score: ${value}`);
    }
    return {
      scoreCp: cp,
      sound: !isUnsoundUciScore('cp', cp),
      rawScore: `cp ${value}`,
    };
  }
  if (kind === 'mate') {
    const mateIn = Number(value);
    if (!Number.isSafeInteger(mateIn)) {
      throw new TypeError(`Invalid mate score: ${value}`);
    }
    const sign = mateIn > 0 ? 1 : -1;
    return {
      scoreCp: sign * (30_000 - Math.abs(mateIn)),
      sound: !isUnsoundUciScore('mate', mateIn),
      rawScore: `mate ${value}`,
    };
  }
  throw new Error(`Unsupported UCI score kind: ${kind}`);
}

function parsePv(tokens: readonly string[]): string[] {
  const pvIndex = tokens.indexOf('pv');
  if (pvIndex < 0) return [];
  return tokens
    .slice(pvIndex + 1)
    .filter((token) => /^[a-h][1-8][a-h][1-8]/.test(token));
}

function parseMultiPv(tokens: readonly string[]): number {
  const index = tokens.indexOf('multipv');
  if (index < 0) return 1;
  const value = Number(tokens[index + 1]);
  return Number.isSafeInteger(value) && value >= 1 ? value : 1;
}

export class UciEngine {
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly reader: Interface;
  private readonly processExit: Promise<void>;
  private ready: Promise<void> | undefined;
  private readonly hashMb: number;
  private readonly threads: number;
  private readonly multiPv: number;
  private readonly coldSearch: boolean;
  private readonly maxScoreEscalations: number;
  private readonly maxInfoLinesPerSearch: number;
  private searchResolve: ((result: DepthLadder) => void) | undefined;
  private searchReject: ((cause: unknown) => void) | undefined;
  private targetDepth = 0;
  private depthBest = new Map<number, UciSearchResult>();
  private multiPvByDepth = new Map<number, Map<number, UciSearchResult>>();
  private multiPvAtMax = new Map<number, UciSearchResult>();
  private lineWaiters: Array<{
    readonly predicate: (line: string) => boolean;
    readonly resolve: () => void;
    readonly reject: (cause: unknown) => void;
  }> = [];
  private stderrTail = '';
  private processFailure: Error | undefined;
  private searchFen: string | undefined;
  private busy = false;
  private infoLines = 0;
  private searchActive = false;

  constructor(options: UciEngineOptions) {
    this.hashMb = options.hashMb ?? 16;
    this.threads = options.threads ?? 1;
    this.multiPv = options.multiPv ?? 1;
    this.coldSearch = options.coldSearch ?? true;
    this.maxScoreEscalations =
      options.maxScoreEscalations ?? DEFAULT_MAX_SCORE_ESCALATIONS;
    this.maxInfoLinesPerSearch =
      options.maxInfoLinesPerSearch ?? DEFAULT_MAX_INFO_LINES_PER_SEARCH;
    if (this.threads !== 1) {
      throw new RangeError('Deterministic mode requires threads === 1.');
    }
    if (!Number.isSafeInteger(this.hashMb) || this.hashMb < 1) {
      throw new RangeError('hashMb must be a positive integer.');
    }
    if (!Number.isSafeInteger(this.multiPv) || this.multiPv < 1) {
      throw new RangeError('multiPv must be a positive integer.');
    }
    if (
      !Number.isSafeInteger(this.maxScoreEscalations) ||
      this.maxScoreEscalations < 0
    ) {
      throw new RangeError(
        'maxScoreEscalations must be a non-negative integer.',
      );
    }
    if (
      !Number.isSafeInteger(this.maxInfoLinesPerSearch) ||
      this.maxInfoLinesPerSearch < 1
    ) {
      throw new RangeError('maxInfoLinesPerSearch must be a positive integer.');
    }
    this.process = spawn(process.execPath, [options.enginePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.processExit = new Promise((resolve) => {
      this.process.once('exit', () => resolve());
    });
    this.reader = createInterface({ input: this.process.stdout });
    this.reader.on('line', (line) => this.dispatch(line.trim()));
    this.process.stderr.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      this.stderrTail = (this.stderrTail + text).slice(-2_000);
    });
    this.process.on('error', (cause) => {
      this.failProcess(
        new UciEngineExitedError(
          null,
          null,
          `${String(cause)}${this.stderrTail}`,
          this.searchFen,
          this.targetDepth,
        ),
      );
    });
    this.process.on('exit', (code, signal) => {
      this.failProcess(
        new UciEngineExitedError(
          code,
          signal,
          this.stderrTail,
          this.searchFen,
          this.targetDepth,
        ),
      );
    });
  }

  /** Lazily start the UCI handshake outside the constructor (S7059). */
  private ensureReady(): Promise<void> {
    this.ready ??= this.handshake();
    return this.ready;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  get lastInfoLineCount(): number {
    return this.infoLines;
  }

  private dispatch(line: string): void {
    if (line.length === 0) return;
    for (let index = 0; index < this.lineWaiters.length; index += 1) {
      const waiter = this.lineWaiters[index];
      if (waiter === undefined) continue;
      if (waiter.predicate(line)) {
        this.lineWaiters.splice(index, 1);
        waiter.resolve();
        return;
      }
    }
    this.onEngineLine(line);
  }

  private onEngineLine(line: string): void {
    if (line.startsWith('info ')) {
      if (this.searchActive) {
        this.infoLines += 1;
        if (this.infoLines > this.maxInfoLinesPerSearch) {
          const error = new UciInfoLineLimitError(
            this.searchFen ?? 'unknown',
            this.targetDepth,
            this.infoLines,
          );
          this.failSearchAndDispose(error);
          return;
        }
      }
      const tokens = line.split(/\s+/);
      const depthIndex = tokens.indexOf('depth');
      if (depthIndex < 0) return;
      const depth = Number(tokens[depthIndex + 1]);
      if (!Number.isSafeInteger(depth) || depth < 1) return;
      // Prefer exact scores over bounds, but keep a bound if it is all we have
      // (Lozza often emits only a lowerbound at the target depth).
      const isBound =
        tokens.includes('lowerbound') || tokens.includes('upperbound');
      try {
        const result = Object.freeze({
          ...parseUciScore(tokens),
          pv: Object.freeze(parsePv(tokens)),
        });
        const multipv = parseMultiPv(tokens);
        if (multipv === 1) {
          const prior = this.depthBest.get(depth);
          if (prior === undefined || !isBound) {
            this.depthBest.set(depth, result);
          }
        }
        if (depth === this.targetDepth) {
          const prior = this.multiPvAtMax.get(multipv);
          if (prior === undefined || !isBound) {
            this.multiPvAtMax.set(multipv, result);
          }
        }
        let atDepth = this.multiPvByDepth.get(depth);
        if (atDepth === undefined) {
          atDepth = new Map();
          this.multiPvByDepth.set(depth, atDepth);
        }
        const prior = atDepth.get(multipv);
        if (prior === undefined || !isBound) {
          atDepth.set(multipv, result);
        }
      } catch {
        // Ignore malformed info lines.
      }
      return;
    }
    if (line.startsWith('bestmove ')) {
      const at = new Map(this.depthBest);
      const multiPvAtMax = new Map(this.multiPvAtMax);
      if (at.size === 0 && multiPvAtMax.size === 0) {
        this.searchReject?.(
          new Error(
            `Engine returned ${line} without a score at depth ${this.targetDepth} ` +
              `for FEN ${this.searchFen ?? 'unknown'}`,
          ),
        );
      } else {
        const multiPvAt = new Map(
          [...this.multiPvByDepth.entries()].map(([depth, lines]) => [
            depth,
            new Map(lines),
          ]),
        );
        this.searchResolve?.(
          Object.freeze({
            maxDepth: this.targetDepth,
            at,
            multiPvAt,
            multiPvAtMax,
          }),
        );
      }
      this.searchResolve = undefined;
      this.searchReject = undefined;
      this.searchActive = false;
      this.depthBest = new Map();
      this.multiPvByDepth = new Map();
      this.multiPvAtMax = new Map();
      this.busy = false;
    }
  }

  private waitForLine(predicate: (line: string) => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.processFailure !== undefined) {
        reject(this.processFailure);
        return;
      }
      const waiter = { predicate, resolve, reject };
      this.lineWaiters.push(waiter);
    });
  }

  private failProcess(cause: UciEngineExitedError): void {
    if (this.processFailure !== undefined) return;
    this.processFailure = cause;
    this.busy = false;
    this.searchReject?.(cause);
    this.searchResolve = undefined;
    this.searchReject = undefined;
    for (const waiter of this.lineWaiters) waiter.reject(cause);
    this.lineWaiters = [];
  }

  private failSearchAndDispose(cause: Error): void {
    if (this.processFailure === undefined) this.processFailure = cause;
    this.busy = false;
    this.searchReject?.(cause);
    this.searchResolve = undefined;
    this.searchReject = undefined;
    this.searchActive = false;
    for (const waiter of this.lineWaiters) waiter.reject(cause);
    this.lineWaiters = [];
    this.reader.close();
    this.process.kill();
  }

  private async handshake(): Promise<void> {
    await this.send('uci');
    await this.waitForLine((line) => line === 'uciok');
    await this.send(`setoption name Threads value ${this.threads}`);
    await this.send(`setoption name Hash value ${this.hashMb}`);
    if (this.multiPv > 1) {
      await this.send(`setoption name MultiPV value ${this.multiPv}`);
    }
    await this.send('isready');
    await this.waitForLine((line) => line === 'readyok');
    await this.send('ucinewgame');
  }

  private send(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.processFailure !== undefined) {
        reject(this.processFailure);
        return;
      }
      this.process.stdin.write(`${command}\n`, (error) => {
        if (error === null || error === undefined) resolve();
        else reject(error);
      });
    });
  }

  private async clearSearchState(): Promise<void> {
    await this.send('ucinewgame');
    await this.send('isready');
    await this.waitForLine((line) => line === 'readyok');
  }

  /** Full depth ladder for shared search (ADR 0017). */
  async searchLadder(fen: string, depth: number): Promise<DepthLadder> {
    if (!Number.isSafeInteger(depth) || depth < 1) {
      throw new RangeError('Depth must be a positive integer.');
    }
    if (this.busy) {
      throw new Error('UciEngine is busy; use the pool scheduler.');
    }
    if (this.processFailure !== undefined) {
      throw this.processFailure;
    }
    this.busy = true;
    await this.ensureReady();
    this.searchFen = fen;
    this.targetDepth = depth;
    this.depthBest = new Map();
    this.multiPvByDepth = new Map();
    this.multiPvAtMax = new Map();
    this.infoLines = 0;
    this.searchActive = false;
    const result = new Promise<DepthLadder>((resolve, reject) => {
      this.searchResolve = resolve;
      this.searchReject = (cause) => {
        this.busy = false;
        reject(cause);
      };
    });
    try {
      if (this.coldSearch) await this.clearSearchState();
      await this.send(`position fen ${fen}`);
      this.searchActive = true;
      await this.send(`go depth ${depth}`);
    } catch (cause: unknown) {
      this.searchReject?.(cause);
      this.searchResolve = undefined;
      this.searchReject = undefined;
      this.searchActive = false;
    }
    return result;
  }

  /** Evaluate `fen` at fixed depth. Score is from the side to move. */
  async evaluate(fen: string, depth: number): Promise<UciSearchResult> {
    for (
      let escalation = 0;
      escalation <= this.maxScoreEscalations;
      escalation += 1
    ) {
      const searchDepth = depth + escalation;
      const ladder = await this.searchLadder(fen, searchDepth);
      const atDepth = ladder.at.get(searchDepth);
      let selected = atDepth;
      if (atDepth !== undefined && atDepth.sound) return atDepth;
      if (atDepth === undefined) {
        for (let d = searchDepth - 1; d >= 1; d -= 1) {
          const fallback = ladder.at.get(d);
          if (fallback !== undefined) {
            selected = fallback;
            if (fallback.sound) return fallback;
            break;
          }
        }
      }
      if (escalation === this.maxScoreEscalations) {
        const reported = selected ?? ladder.multiPvAtMax.get(1);
        if (reported !== undefined) {
          if (reported.sound) return reported;
          throw new UciUnsoundScoreError(
            fen,
            depth,
            reported.rawScore,
            escalation,
          );
        }
      }
    }
    throw new Error(`Engine produced no score at depth ${depth}`);
  }

  async dispose(): Promise<void> {
    await this.send('quit').catch(() => undefined);
    this.reader.close();
    this.process.kill();
    await this.processExit;
  }
}
