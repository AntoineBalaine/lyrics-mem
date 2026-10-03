import { describe, expect, it } from 'vitest';
import { applyChordLevel, applyChordLevelToChordGrid } from './chord-cloze';

const ONE_CHORD_PER_BAR = [
  'X:1',
  'T:Test',
  'K:C',
  '"C"x4 | "F"x4 | "G"x4 | "Am"x4 | "Dm"x4 | "G7"x4 | "C"x4 | "C"x4 |',
].join('\n');

const TWO_CHORDS_PER_BAR = [
  'X:1',
  'T:Test',
  'K:C',
  '"Cm7"x4 "F7"x4 | "Bbmaj7"x4 "Ebmaj7"x4 | "Am7b5"x4 "D7"x4 | "Gm7"x4 "Gm7"x4 |',
].join('\n');

describe('applyChordLevel', () => {
  it('level 1 leaves the ABC text unchanged', () => {
    expect(applyChordLevel(1, ONE_CHORD_PER_BAR)).toBe(ONE_CHORD_PER_BAR);
    expect(applyChordLevel(1, TWO_CHORDS_PER_BAR)).toBe(TWO_CHORDS_PER_BAR);
  });

  it('level 4 blanks every chord annotation to dashes of the same length', () => {
    const result = applyChordLevel(4, ONE_CHORD_PER_BAR);
    expect(result).toContain('"-"x4 | "-"x4 | "-"x4 | "--"x4 | "--"x4 | "--"x4 | "-"x4 | "-"x4 |');

    const result2 = applyChordLevel(4, TWO_CHORDS_PER_BAR);
    expect(result2).toContain('"---"');
    expect(result2).not.toMatch(/"C|"F|"B|"E|"A|"D|"G/);
  });

  it('level 2 blanks bars 2 and 4 of every 4-bar group (one chord per bar)', () => {
    const result = applyChordLevel(2, ONE_CHORD_PER_BAR);
    const bars = result
      .split('\n')
      .pop()!
      .split('|')
      .map((b) => b.trim())
      .filter((b) => b !== '');
    // bars: C(1) F(2) G(3) Am(4) Dm(5) G7(6) C(7) C(8)
    expect(bars[0]).toContain('"C"');
    expect(bars[1]).toContain('"-"');
    expect(bars[2]).toContain('"G"');
    expect(bars[3]).toContain('"--"');
    expect(bars[4]).toContain('"Dm"');
    expect(bars[5]).toContain('"--"');
    expect(bars[6]).toContain('"C"');
    expect(bars[7]).toContain('"-"');
  });

  it('level 2 blanks both chords in a hidden bar (two chords per bar)', () => {
    const result = applyChordLevel(2, TWO_CHORDS_PER_BAR);
    const bars = result
      .split('\n')
      .pop()!
      .split('|')
      .map((b) => b.trim())
      .filter((b) => b !== '');
    expect(bars[0]).toContain('"Cm7"');
    expect(bars[0]).toContain('"F7"');
    expect(bars[1]).toContain('"------"'); // "Bbmaj7" and "Ebmaj7" (6 chars each)
    expect(bars[2]).toContain('"Am7b5"');
    expect(bars[2]).toContain('"D7"');
    expect(bars[3]).toContain('"---"'); // "Gm7" (3 chars)
  });

  it('level 3 keeps only the first bar of every 4-bar group', () => {
    const result = applyChordLevel(3, ONE_CHORD_PER_BAR);
    const bars = result
      .split('\n')
      .pop()!
      .split('|')
      .map((b) => b.trim())
      .filter((b) => b !== '');
    expect(bars[0]).toContain('"C"');
    expect(bars[1]).toContain('"-"');
    expect(bars[2]).toContain('"-"');
    expect(bars[3]).toContain('"--"');
    expect(bars[4]).toContain('"Dm"'); // first bar of the second group
    expect(bars[5]).toContain('"--"');
    expect(bars[6]).toContain('"-"');
    expect(bars[7]).toContain('"-"');
  });

  it('level 3 with two chords per bar keeps both chords of the group-opening bar only', () => {
    const result = applyChordLevel(3, TWO_CHORDS_PER_BAR);
    const bars = result
      .split('\n')
      .pop()!
      .split('|')
      .map((b) => b.trim())
      .filter((b) => b !== '');
    expect(bars[0]).toContain('"Cm7"');
    expect(bars[0]).toContain('"F7"');
    expect(bars[1]).not.toMatch(/"(Bbmaj7|Ebmaj7)"/);
    expect(bars[2]).not.toMatch(/"(Am7b5|D7)"/);
    expect(bars[3]).not.toMatch(/"Gm7"/);
  });

  it('leaves header lines (X:, T:, K:) untouched at every level', () => {
    for (const level of [2, 3, 4] as const) {
      const result = applyChordLevel(level, ONE_CHORD_PER_BAR);
      expect(result).toContain('X:1');
      expect(result).toContain('T:Test');
      expect(result).toContain('K:C');
    }
  });
});

describe('applyChordLevelToChordGrid', () => {
  const PLAIN_GRID = 'C | F | G | Am | Dm | G7 | C | C |';

  it('level 1 leaves the grid unchanged', () => {
    expect(applyChordLevelToChordGrid(1, PLAIN_GRID)).toBe(PLAIN_GRID);
  });

  it('level 4 blanks every chord to dashes of the same length', () => {
    expect(applyChordLevelToChordGrid(4, PLAIN_GRID)).toBe('- | - | - | -- | -- | -- | - | - |');
  });

  it('level 2 blanks bars 2 and 4 of every 4-bar group', () => {
    expect(applyChordLevelToChordGrid(2, PLAIN_GRID)).toBe('C | - | G | -- | Dm | -- | C | - |');
  });

  it('level 3 keeps only the first bar of every 4-bar group', () => {
    expect(applyChordLevelToChordGrid(3, PLAIN_GRID)).toBe('C | - | - | -- | Dm | -- | - | - |');
  });

  it('blanks multiple chords within one bar independently', () => {
    const grid = 'Cm7 F7 | Bbmaj7 Ebmaj7 |';
    expect(applyChordLevelToChordGrid(2, grid)).toBe('Cm7 F7 | ------ ------ |');
  });
});
