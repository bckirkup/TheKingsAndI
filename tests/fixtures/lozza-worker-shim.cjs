'use strict';

/*
 * Test shim: run the vendored `vendor/lozza/lozza.cjs` under
 * `node:worker_threads` by presenting it as a Web Worker. The script takes
 * its browser branch when `process` is undefined (`onmessage`/`postMessage`),
 * so the shim hides the Node globals and bridges the worker messaging APIs
 * onto `parentPort`. This is what exercises the same code path the browser
 * worker runs, without needing a DOM.
 */

const { parentPort } = require('worker_threads');

globalThis.process = undefined;
globalThis.console = { log: () => undefined };
globalThis.postMessage = (message) => {
  parentPort.postMessage(message);
};
let messageHandler = () => undefined;
Object.defineProperty(globalThis, 'onmessage', {
  set(handler) {
    messageHandler = handler;
  },
});

require('../../vendor/lozza/lozza.cjs');

parentPort.on('message', (data) => {
  messageHandler({ data });
});
