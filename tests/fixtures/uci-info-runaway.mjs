/* global console, process */

import readline from 'node:readline';

const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (line === 'uci') {
    console.log('id name info-runaway-test');
    console.log('uciok');
  } else if (line === 'isready') {
    console.log('readyok');
  } else if (line.startsWith('go depth ')) {
    for (let index = 1; index <= 16; index += 1) {
      console.log(`info depth 1 score cp ${index} pv e2e4`);
    }
    console.log('bestmove e2e4');
  }
});
