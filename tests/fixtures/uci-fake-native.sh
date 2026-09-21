#!/bin/sh
# Minimal fake native UCI engine: answers the handshake and any `go depth N`
# with a fixed single-line result, for spawn-mode tests only.
while IFS= read -r line; do
  case "$line" in
    uci)
      printf 'id name FakeNative\n'
      printf 'id author test\n'
      printf 'uciok\n'
      ;;
    isready)
      printf 'readyok\n'
      ;;
    go\ depth*)
      printf 'info depth 1 multipv 1 score cp 12 pv e2e4\n'
      printf 'bestmove e2e4\n'
      ;;
    quit)
      exit 0
      ;;
  esac
done
