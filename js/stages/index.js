import stage1 from './stage1.js';

export const STAGES = { 1: stage1 };

// Arcade-style stage order per level: 1 = ice ledges, 2 = fish factory, 3 = ski lifts, 4 = ice-bolt peak.
const SEQUENCES = [
  [1, 4],
  [1, 3, 4],
  [1, 2, 3, 4],
  [1, 2, 1, 3, 4],
  [1, 2, 1, 2, 3, 4],
];

// Stages not built yet are skipped.
export function stageSequence(level) {
  const seq = SEQUENCES[Math.min(level, SEQUENCES.length) - 1].filter((id) => STAGES[id]);
  return seq.length ? seq : [1];
}
