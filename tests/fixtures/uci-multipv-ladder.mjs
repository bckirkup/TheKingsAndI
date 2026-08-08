/* global console, process */

import readline from 'node:readline';

const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (line === 'uci') {
    console.log('id name multipv-ladder-test');
    console.log('uciok');
  } else if (line === 'isready') {
    console.log('readyok');
  } else if (line.startsWith('go depth ')) {
    console.log('info depth 1 multipv 1 score cp 10 pv e2e4');
    console.log('info depth 1 multipv 2 score cp 5 pv d2d4');
    console.log('info depth 2 multipv 1 score cp 20 pv e2e4 e7e5');
    console.log('info depth 2 multipv 2 score cp 15 pv d2d4 d7d5');
    console.log('bestmove e2e4');
  }
});
