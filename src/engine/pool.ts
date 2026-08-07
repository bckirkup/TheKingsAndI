import { cpus } from 'node:os';

import { UciEngine, type DepthLadder } from './uci';

/**
 * Worker pool for UCI engines (ADR 0005 / architecture §5).
 * Size: `min(hardwareConcurrency - 1, 4)`, floored at 1.
 */

export function defaultPoolSize(): number {
  const nav =
    typeof globalThis !== 'undefined'
      ? (globalThis as { navigator?: { hardwareConcurrency?: number } })
          .navigator
      : undefined;
  const hardware =
    typeof nav?.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0
      ? nav.hardwareConcurrency
      : cpus().length;
  return Math.max(1, Math.min(hardware - 1, 4));
}

export interface EnginePoolOptions {
  readonly enginePath: string;
  readonly hashMb?: number;
  readonly threads?: number;
  readonly multiPv?: number;
  readonly size?: number;
}

interface Waiter {
  readonly resolve: (engine: UciEngine) => void;
  readonly reject: (cause: unknown) => void;
}

/**
 * Fixed-size pool of single-threaded UCI workers. Searches are scheduled FIFO;
 * no wall-clock preemption (ADR 0034).
 */
export class EnginePool {
  private readonly workers: UciEngine[] = [];
  private readonly idle: UciEngine[] = [];
  private readonly waiters: Waiter[] = [];
  private disposed = false;

  private constructor() {}

  static async create(options: EnginePoolOptions): Promise<EnginePool> {
    const size = options.size ?? defaultPoolSize();
    if (!Number.isSafeInteger(size) || size < 1) {
      throw new RangeError('Pool size must be a positive integer.');
    }
    const pool = new EnginePool();
    for (let index = 0; index < size; index += 1) {
      const worker = new UciEngine({
        enginePath: options.enginePath,
        threads: 1,
        ...(options.hashMb !== undefined ? { hashMb: options.hashMb } : {}),
        ...(options.multiPv !== undefined ? { multiPv: options.multiPv } : {}),
      });
      pool.workers.push(worker);
      pool.idle.push(worker);
    }
    return pool;
  }

  get size(): number {
    return this.workers.length;
  }

  private acquire(): Promise<UciEngine> {
    if (this.disposed) {
      return Promise.reject(new Error('EnginePool has been disposed.'));
    }
    const idle = this.idle.pop();
    if (idle !== undefined) return Promise.resolve(idle);
    return new Promise<UciEngine>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  private release(worker: UciEngine): void {
    if (this.disposed) return;
    const next = this.waiters.shift();
    if (next !== undefined) {
      next.resolve(worker);
      return;
    }
    this.idle.push(worker);
  }

  async searchLadder(fen: string, depth: number): Promise<DepthLadder> {
    const worker = await this.acquire();
    try {
      return await worker.searchLadder(fen, depth);
    } finally {
      this.release(worker);
    }
  }

  async evaluate(
    fen: string,
    depth: number,
  ): Promise<{ scoreCp: number; pv: readonly string[] }> {
    const ladder = await this.searchLadder(fen, depth);
    const atDepth = ladder.at.get(depth) ?? ladder.multiPvAtMax.get(1);
    if (atDepth === undefined) {
      throw new Error(`Engine produced no score at depth ${depth}`);
    }
    return atDepth;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const waiter of this.waiters) {
      waiter.reject(new Error('EnginePool disposed while waiting.'));
    }
    this.waiters.length = 0;
    await Promise.all(this.workers.map((worker) => worker.dispose()));
    this.workers.length = 0;
    this.idle.length = 0;
  }
}
