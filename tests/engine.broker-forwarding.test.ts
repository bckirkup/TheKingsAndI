import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createSharedSearchBroker,
  type SharedSearchBroker,
} from '../src/engine/broker';
import { UciInfoLineLimitError } from '../src/engine/uci';

const fixturePath = fileURLToPath(
  new URL('./fixtures/uci-info-runaway.mjs', import.meta.url),
);
const FEN = '8/8/8/8/8/8/8/7K w - - 0 1';

let brokers: SharedSearchBroker[] = [];

afterEach(async () => {
  await Promise.all(brokers.map((broker) => broker.dispose()));
  brokers = [];
});

describe('shared-search broker engine options', () => {
  it('forwards the info-line ceiling to both worker pools', async () => {
    const broker = await createSharedSearchBroker({
      enginePath: fixturePath,
      determinismId: 'fixture',
      dMax: 1,
      maxInfoLinesPerSearch: 3,
      size: 1,
      preferredPoolSize: 1,
    });
    brokers.push(broker);

    await expect(broker.evaluate(FEN, 1)).rejects.toBeInstanceOf(
      UciInfoLineLimitError,
    );
    await expect(broker.bestAt(FEN, 1)).rejects.toBeInstanceOf(
      UciInfoLineLimitError,
    );
  });
});
