# Engine

Engine ports and workers will live here.

Nothing outside this layer may learn which engine exists (ADR 0020), and results
leave it only through the per-ply query barrier — issued and collected in
`PieceId` order, frozen before psychology runs (ADR 0034). `Promise.race`,
`Promise.any`, wall-clock timeouts, and `Date.now` are lint errors here for that
reason.
