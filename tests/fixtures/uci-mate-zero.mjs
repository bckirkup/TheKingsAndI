/* global console, process */

import readline from 'node:readline';

const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (line === 'uci') {
    console.log('id name mate-zero-test');
    console.log('uciok');
  } else if (line === 'isready') {
    console.log('readyok');
  } else if (line.startsWith('go depth ')) {
    console.log('info depth 1 score mate 0 pv e2e4');
    console.log('bestmove e2e4');
  }
});
