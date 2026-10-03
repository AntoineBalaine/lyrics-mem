import { describe, expect, it } from 'vitest';
import { applyNotationModeToChordGrid, parseAbcKey } from './chord-numbers';

const C_MAJOR_KEY_HEADER = 'X:1\nT:Test\nK:C\n';
const A_MINOR_KEY_HEADER = 'X:1\nT:Test minor\nK:Am\n';

const C_MAJOR_GRID = 'Cmaj7 Dm7 | Em7 Fmaj7 | G7 Am7 | Bm7b5 Cmaj7 |';
const A_MINOR_GRID = 'Am7 Dm7 | G7 Cmaj7 |';

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

describe('applyNotationModeToChordGrid', () => {
  it('symbols mode leaves the grid unchanged', () => {
    const key = parseAbcKey(C_MAJOR_KEY_HEADER);
    expect(applyNotationModeToChordGrid('symbols', key, C_MAJOR_GRID)).toBe(C_MAJOR_GRID);
  });

  it('nashville mode substitutes the root with a major-scale degree, keeping quality suffixes', () => {
    const key = parseAbcKey(C_MAJOR_KEY_HEADER);
    const result = applyNotationModeToChordGrid('nashville', key, C_MAJOR_GRID);
    expect(result).toContain('1maj7');
    expect(result).toContain('2m7');
    expect(result).toContain('3m7');
    expect(result).toContain('4maj7');
    expect(result).toContain('57');
    expect(result).toContain('6m7');
    expect(result).toContain('7m7b5');
  });

  it("numbers mode reads a minor key's diatonic chords as plain degrees, not renumbered against the relative major", () => {
    const key = parseAbcKey(A_MINOR_KEY_HEADER);
    const result = applyNotationModeToChordGrid('numbers', key, A_MINOR_GRID);
    expect(result).toContain('1m7'); // Am7 — tonic
    expect(result).toContain('4m7'); // Dm7
    expect(result).toContain('77'); // G7 — diatonic 7th of natural minor, no flat needed
    expect(result).toContain('3maj7'); // Cmaj7 — diatonic 3rd of natural minor, no flat needed
  });

  it('nashville mode reads a minor key off its relative major, not off the minor tonic itself', () => {
    // A minor's relative major is C major, so Am7 (the tonic chord) reads
    // as the relative major's vi — "6" — not "1".
    const key = parseAbcKey(A_MINOR_KEY_HEADER);
    const result = applyNotationModeToChordGrid('nashville', key, A_MINOR_GRID);
    expect(result).toContain('6m7'); // Am7 — tonic, vi of the relative major (C)
    expect(result).toContain('2m7'); // Dm7
    expect(result).toContain('57'); // G7
    expect(result).toContain('1maj7'); // Cmaj7 — the relative major's own tonic
  });

  it('leaves non-chord tokens (bar separators) untouched', () => {
    const key = parseAbcKey(C_MAJOR_KEY_HEADER);
    expect(applyNotationModeToChordGrid('nashville', key, '|: Dm :| |')).toBe('|: 2m :| |');
  });
});
