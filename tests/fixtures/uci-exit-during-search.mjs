/* global console, process */

import readline from 'node:readline';

const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (line === 'uci') {
    console.log('id name exit-during-search-test');
    console.log('uciok');
  } else if (line === 'isready') {
    console.log('readyok');
  } else if (line.startsWith('go depth ')) {
    process.exit(17);
  }
});
