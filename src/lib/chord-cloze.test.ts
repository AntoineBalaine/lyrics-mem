import { describe, expect, it } from 'vitest';
import { barHiding, CHORD_LEVELS, type BarHiding, type ChordLevel } from './chord-cloze';

/**
 * Tests for the level arithmetic alone. What a hidden bar actually looks
 * like belongs to the renderer and is tested in chord-grid-render.test.ts.
 */
const eightBars = [0, 1, 2, 3, 4, 5, 6, 7];

function pattern(level: ChordLevel): string {
  return eightBars.map((i) => barHiding(i, level)[0]).join('');
}

describe('barHiding', () => {
  it('hides nothing at the first level', () => {
    expect(pattern(1)).to.equal('nnnnnnnn');
  });

  it('hides only the qualities at the second level, in every bar', () => {
    expect(pattern(2)).to.equal('qqqqqqqq');
  });

  it('hides every second bar at the third level, qualities still gone', () => {
    expect(pattern(3)).to.equal('qaqaqaqa');
  });

  it('keeps only the first bar of each group at the fourth level', () => {
    expect(pattern(4)).to.equal('qaaaqaaa');
  });

  it('hides every bar at the last level', () => {
    expect(pattern(5)).to.equal('aaaaaaaa');
  });

  it('restarts the grouping at every fourth bar', () => {
    // The fifth bar begins a new group, so it is visible again at the
    // levels that group bars at all.
    expect(barHiding(4, 3)).to.equal('quality');
    expect(barHiding(4, 4)).to.equal('quality');
  });

  it('never hands back, bar by bar, anything an earlier level hid', () => {
    // The levels are cumulative, so for every bar the amount hidden can
    // only grow as the level rises. A level showing a quality that the one
    // before it had taken away is the defect this pins.
    expect(CHORD_LEVELS.length).to.equal(5);
    const rank: Record<BarHiding, number> = { none: 0, quality: 1, all: 2 };
    for (const index of eightBars) {
      for (let i = 1; i < CHORD_LEVELS.length; i++) {
        const previous = rank[barHiding(index, CHORD_LEVELS[i - 1])];
        const current = rank[barHiding(index, CHORD_LEVELS[i])];
        expect(current, `bar ${index}, level ${CHORD_LEVELS[i]}`).to.be.at.least(previous);
      }
    }
  });
});
