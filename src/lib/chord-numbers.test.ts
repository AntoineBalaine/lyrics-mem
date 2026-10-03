import { describe, expect, it } from 'vitest';
import { applyNotationMode, parseAbcKey } from './chord-numbers';

const C_MAJOR_CHART = [
  'X:1',
  'T:Test',
  'K:C',
  '"Cmaj7"x4 "Dm7"x4 | "Em7"x4 "Fmaj7"x4 | "G7"x4 "Am7"x4 | "Bm7b5"x4 "Cmaj7"x4 |',
].join('\n');

const A_MINOR_CHART = [
  'X:1',
  'T:Test minor',
  'K:Am',
  '"Am7"x4 "Dm7"x4 | "G7"x4 "Cmaj7"x4 |',
].join('\n');

describe('parseAbcKey', () => {
  it('parses a bare major key', () => {
    expect(parseAbcKey('K:C\n').root).toBe('C');
  });
  it('parses a minor key', () => {
    const key = parseAbcKey('K:Am\n');
    expect(key.root).toBe('A');
    expect(key.mode).toBe('m');
  });
  it('defaults to C major when no K: header is present', () => {
    expect(parseAbcKey('X:1\nT:No key\n').root).toBe('C');
  });
});

describe('applyNotationMode', () => {
  it('symbols mode leaves the ABC text unchanged', () => {
    expect(applyNotationMode('symbols', C_MAJOR_CHART)).toBe(C_MAJOR_CHART);
  });

  it('nashville mode substitutes the root with a major-scale degree, keeping quality suffixes', () => {
    const result = applyNotationMode('nashville', C_MAJOR_CHART);
    expect(result).toContain('"1maj7"');
    expect(result).toContain('"2m7"');
    expect(result).toContain('"3m7"');
    expect(result).toContain('"4maj7"');
    expect(result).toContain('"57"');
    expect(result).toContain('"6m7"');
    expect(result).toContain('"7m7b5"');
  });

  it("numbers mode reads a minor key's diatonic chords as plain degrees, not renumbered against the relative major", () => {
    const result = applyNotationMode('numbers', A_MINOR_CHART);
    expect(result).toContain('"1m7"'); // Am7 — tonic
    expect(result).toContain('"4m7"'); // Dm7
    expect(result).toContain('"77"'); // G7 — diatonic 7th of natural minor, no flat needed
    expect(result).toContain('"3maj7"'); // Cmaj7 — diatonic 3rd of natural minor, no flat needed
  });

  it('nashville mode renumbers the same minor-key chords against the major scale', () => {
    const result = applyNotationMode('nashville', A_MINOR_CHART);
    expect(result).toContain('"1m7"');
    expect(result).toContain('"4m7"');
    expect(result).toContain('"b77"'); // G is a minor 7th, flat relative to A major
    expect(result).toContain('"b3maj7"'); // C is a minor 3rd, flat relative to A major
  });

  it('leaves non-chord annotation text untouched', () => {
    const abc = 'K:C\n"not a chord"x4 |';
    expect(applyNotationMode('nashville', abc)).toBe(abc);
  });
});
