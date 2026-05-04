import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  applyStep,
  step1Full,
  step3BionicStripped,
  step4FirstLetters,
  step5FirstLineLetters,
  STEPS,
} from './transformations';

describe('step1Full', () => {
  it('returns text unchanged', () => {
    expect(step1Full('hello\nworld')).toBe('hello\nworld');
  });
});

describe('step4FirstLetters', () => {
  it('returns first letter of each word per line', () => {
    expect(step4FirstLetters('Hello there world\nFoo bar')).toBe('H t w\nF b');
  });

  it('preserves blank lines as blank lines', () => {
    expect(step4FirstLetters('hi\n\nbye')).toBe('h\n\nb');
  });
});

describe('step5FirstLineLetters', () => {
  it('returns first letter of each line', () => {
    expect(step5FirstLineLetters('Hello there\nWorld how\nAre you')).toBe('H\nW\nA');
  });
});

describe('step3BionicStripped', () => {
  it('preserves whitespace and line breaks', () => {
    const out = step3BionicStripped('Hello world\nFoo bar');
    expect(out.split('\n')).toHaveLength(2);
  });

  it('keeps token length stable', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z ]{1,40}$/),
        (line) => step3BionicStripped(line).length === line.length,
      ),
    );
  });
});

describe('applyStep', () => {
  it('returns a string for every step', () => {
    const text = 'Yesterday all my troubles seemed so far away';
    for (const s of STEPS) {
      expect(typeof applyStep(s, text)).toBe('string');
    }
  });
});
