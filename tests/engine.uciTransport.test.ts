import { describe, expect, it, vi } from 'vitest';

import {
  UciEngine,
  type UciTransport,
  type UciTransportExit,
} from '../src/engine/uci';

const FEN = '8/8/8/8/8/8/8/7K w - - 0 1';

/**
 * Canned UCI engine: answers protocol lines asynchronously, like a worker
 * would. Replies go out on the next task so a send resolves before its
 * response lines arrive (the ordering a real stdio/postMessage host gives).
 */
class ScriptedTransport implements UciTransport {
  readonly sent: string[] = [];
  private lineListener: ((line: string) => void) | undefined;
  private exitListener: ((exit: UciTransportExit) => void) | undefined;
  disposed = false;
  /** Never answer `go depth` — the search stays in flight until the exit. */
  hangOnGo = false;

  readonly sendLine = (line: string): void => {
    this.sent.push(line);
    const replies = this.reply(line);
    if (replies.length > 0) {
      setTimeout(() => {
        for (const reply of replies) this.lineListener?.(reply);
      }, 0);
    }
  };

  readonly onLine = (listener: (line: string) => void): void => {
    this.lineListener = listener;
  };

  readonly onExit = (listener: (exit: UciTransportExit) => void): void => {
    this.exitListener = listener;
  };

  readonly dispose = (): Promise<void> => {
    this.disposed = true;
    return Promise.resolve();
  };

  emitExit(exit: UciTransportExit): void {
    this.exitListener?.(exit);
  }

  private reply(line: string): readonly string[] {
    if (line === 'uci') return ['id name scripted', 'uciok'];
    if (line === 'isready') return ['readyok'];
    if (line.startsWith('go depth ')) {
      if (this.hangOnGo) return [];
      const depth = Number(line.slice('go depth '.length));
      return [
        `info depth ${depth} multipv 1 score cp 41 pv e2e4`,
        'bestmove e2e4',
      ];
    }
    return [];
  }
}

describe('UciEngine over an injected transport', () => {
  it('runs the handshake and a cold search on the scripted wire', async () => {
    const transport = new ScriptedTransport();
    const engine = new UciEngine({
      enginePath: 'scripted',
      transport: () => transport,
    });
    const result = await engine.evaluate(FEN, 4);
    expect(result.scoreCp).toBe(41);
    expect(result.pv).toEqual(['e2e4']);
    expect(transport.sent).toEqual([
      'uci',
      'setoption name Threads value 1',
      'setoption name Hash value 16',
      'isready',
      'ucinewgame',
      'ucinewgame',
      'isready',
      `position fen ${FEN}`,
      'go depth 4',
    ]);
    await engine.dispose();
    expect(transport.disposed).toBe(true);
    expect(transport.sent.at(-1)).toBe('quit');
  });

  it('rejects an in-flight search when the transport reports an exit', async () => {
    const transport = new ScriptedTransport();
    transport.hangOnGo = true;
    const engine = new UciEngine({
      enginePath: 'scripted',
      transport: () => transport,
    });
    const pending = engine.evaluate(FEN, 2);
    await vi.waitFor(() => {
      expect(transport.sent).toContain('go depth 2');
    });
    transport.emitExit({ code: 7, signal: null, stderr: 'boom' });
    await expect(pending).rejects.toThrow(
      `Engine child exited with code 7 at depth 2 for FEN ${FEN}; stderr: boom`,
    );
    await engine.dispose();
  });
});
