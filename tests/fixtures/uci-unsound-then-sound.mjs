/* global console, process */

import readline from 'node:readline';

let searches = 0;
const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (line === 'uci') {
    console.log('id name unsound-then-sound-test');
    console.log('uciok');
  } else if (line === 'isready') {
    console.log('readyok');
  } else if (line.startsWith('go depth ')) {
    searches += 1;
    const score = searches === 1 ? 'mate 0' : 'cp 42';
    console.log(`info depth ${line.slice(9)} score ${score} pv e2e4`);
    console.log('bestmove e2e4');
  }
});
