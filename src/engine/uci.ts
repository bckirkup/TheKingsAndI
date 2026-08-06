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
  /** Absolute path to the engine script (e.g. lozza.cjs). */
  readonly enginePath: string;
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
    if (!Number.isSafeInteger(mateIn) || mateIn === 0) {
      throw new Error(`Invalid mate score: ${value}`);
    }
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

export class UciEngine {
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly reader: Interface;
  private readonly ready: Promise<void>;
  private searchResolve: ((result: UciSearchResult) => void) | undefined;
  private searchReject: ((cause: unknown) => void) | undefined;
  private targetDepth = 0;
  private bestAtDepth: UciSearchResult | undefined;
  private lineWaiters: Array<(line: string) => boolean> = [];

  constructor(options: UciEngineOptions) {
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
      if (!Number.isSafeInteger(depth)) return;
      if (depth !== this.targetDepth) return;
      try {
        this.bestAtDepth = Object.freeze({
          scoreCp: parseScoreCp(tokens),
          pv: Object.freeze(parsePv(tokens)),
        });
      } catch {
        // Ignore malformed info lines.
      }
      return;
    }
    if (line.startsWith('bestmove ')) {
      const result = this.bestAtDepth;
      if (result === undefined) {
        this.searchReject?.(
          new Error('Engine returned bestmove without a score'),
        );
      } else {
        this.searchResolve?.(result);
      }
      this.searchResolve = undefined;
      this.searchReject = undefined;
      this.bestAtDepth = undefined;
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

  /** Evaluate `fen` at fixed depth. Score is from the side to move. */
  async evaluate(fen: string, depth: number): Promise<UciSearchResult> {
    if (!Number.isSafeInteger(depth) || depth < 1) {
      throw new RangeError('Depth must be a positive integer.');
    }
    await this.ready;
    this.targetDepth = depth;
    this.bestAtDepth = undefined;
    const result = new Promise<UciSearchResult>((resolve, reject) => {
      this.searchResolve = resolve;
      this.searchReject = reject;
    });
    await this.send(`position fen ${fen}`);
    await this.send(`go depth ${depth}`);
    return result;
  }

  async dispose(): Promise<void> {
    await this.send('quit').catch(() => undefined);
    this.reader.close();
    this.process.kill();
  }
}
