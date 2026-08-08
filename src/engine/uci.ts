import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

/**
 * Minimal UCI client for depth-limited search (ADR 0005). No movetime, no
 * wall-clock cutoffs — only `go depth N`.
 */

export interface UciSearchResult {
  readonly scoreCp: number;
  readonly pv: readonly string[];
}

export interface UciEngineOptions {
  /** Absolute path to the engine script (e.g. lozza.cjs or stockfish-*.js). */
  readonly enginePath: string;
  /** Fixed hash size in MiB (deterministic mode). */
  readonly hashMb?: number;
  /** Must stay 1 for determinism (ADR 0005). */
  readonly threads?: number;
  /** MultiPV count for shared-search trees (ADR 0017). */
  readonly multiPv?: number;
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

function parseScoreCp(tokens: readonly string[]): number {
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
      throw new Error(`Non-integer centipawn score: ${value}`);
    }
    return cp;
  }
  if (kind === 'mate') {
    const mateIn = Number(value);
    if (!Number.isSafeInteger(mateIn)) {
      throw new Error(`Invalid mate score: ${value}`);
    }
    // Lozza reports an immediate forced mate as `mate 0` alongside the mating
    // pv, so treat it as decisive for the side to move. Orchestration scores
    // already-terminal positions itself and never queries the engine for them.
    if (mateIn === 0) return 29_999;
    const sign = mateIn > 0 ? 1 : -1;
    return sign * (30_000 - Math.abs(mateIn));
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
  private readonly ready: Promise<void>;
  private readonly hashMb: number;
  private readonly threads: number;
  private readonly multiPv: number;
  private searchResolve: ((result: DepthLadder) => void) | undefined;
  private searchReject: ((cause: unknown) => void) | undefined;
  private targetDepth = 0;
  private depthBest = new Map<number, UciSearchResult>();
  private multiPvByDepth = new Map<number, Map<number, UciSearchResult>>();
  private multiPvAtMax = new Map<number, UciSearchResult>();
  private lineWaiters: Array<(line: string) => boolean> = [];
  private busy = false;

  constructor(options: UciEngineOptions) {
    this.hashMb = options.hashMb ?? 16;
    this.threads = options.threads ?? 1;
    this.multiPv = options.multiPv ?? 1;
    if (this.threads !== 1) {
      throw new RangeError('Deterministic mode requires threads === 1.');
    }
    if (!Number.isSafeInteger(this.hashMb) || this.hashMb < 1) {
      throw new RangeError('hashMb must be a positive integer.');
    }
    if (!Number.isSafeInteger(this.multiPv) || this.multiPv < 1) {
      throw new RangeError('multiPv must be a positive integer.');
    }
    this.process = spawn(process.execPath, [options.enginePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.reader = createInterface({ input: this.process.stdout });
    this.reader.on('line', (line) => this.dispatch(line.trim()));
    this.process.on('error', (cause) => this.searchReject?.(cause));
    this.process.on('exit', (code) => {
      if (this.searchReject !== undefined) {
        this.searchReject(
          new Error(`Engine exited with code ${code ?? 'unknown'}`),
        );
      }
    });
    this.ready = this.handshake();
  }

  get isBusy(): boolean {
    return this.busy;
  }

  private dispatch(line: string): void {
    if (line.length === 0) return;
    for (let index = 0; index < this.lineWaiters.length; index += 1) {
      const waiter = this.lineWaiters[index];
      if (waiter === undefined) continue;
      if (waiter(line)) {
        this.lineWaiters.splice(index, 1);
        return;
      }
    }
    this.onEngineLine(line);
  }

  private onEngineLine(line: string): void {
    if (line.startsWith('info ')) {
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
          scoreCp: parseScoreCp(tokens),
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
          new Error(`Engine returned ${line} without a score`),
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
      this.depthBest = new Map();
      this.multiPvByDepth = new Map();
      this.multiPvAtMax = new Map();
      this.busy = false;
    }
  }

  private waitForLine(predicate: (line: string) => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter = (line: string): boolean => {
        if (predicate(line)) {
          resolve();
          return true;
        }
        return false;
      };
      this.lineWaiters.push(waiter);
      this.process.once('error', reject);
    });
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
      this.process.stdin.write(`${command}\n`, (error) => {
        if (error === null || error === undefined) resolve();
        else reject(error);
      });
    });
  }

  /** Full depth ladder for shared search (ADR 0017). */
  async searchLadder(fen: string, depth: number): Promise<DepthLadder> {
    if (!Number.isSafeInteger(depth) || depth < 1) {
      throw new RangeError('Depth must be a positive integer.');
    }
    if (this.busy) {
      throw new Error('UciEngine is busy; use the pool scheduler.');
    }
    this.busy = true;
    await this.ready;
    this.targetDepth = depth;
    this.depthBest = new Map();
    this.multiPvByDepth = new Map();
    this.multiPvAtMax = new Map();
    const result = new Promise<DepthLadder>((resolve, reject) => {
      this.searchResolve = resolve;
      this.searchReject = (cause) => {
        this.busy = false;
        reject(cause);
      };
    });
    await this.send(`position fen ${fen}`);
    await this.send(`go depth ${depth}`);
    return result;
  }

  /** Evaluate `fen` at fixed depth. Score is from the side to move. */
  async evaluate(fen: string, depth: number): Promise<UciSearchResult> {
    const ladder = await this.searchLadder(fen, depth);
    for (let d = depth; d >= 1; d -= 1) {
      const atDepth = ladder.at.get(d);
      if (atDepth !== undefined) return atDepth;
    }
    const fallback = ladder.multiPvAtMax.get(1);
    if (fallback === undefined) {
      throw new Error(`Engine produced no score at depth ${depth}`);
    }
    return fallback;
  }

  async dispose(): Promise<void> {
    await this.send('quit').catch(() => undefined);
    this.reader.close();
    this.process.kill();
  }
}
