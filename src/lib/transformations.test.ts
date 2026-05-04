import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  applyStep,
  step2BionicStripped,
  step3FirstLetters,
  step4FirstLineLetters,
  STEPS,
} from './transformations';

describe('step3FirstLetters', () => {
  it('keeps each word at its original width with underscores', () => {
    expect(step3FirstLetters('Hello there world\nFoo bar')).toBe('H____ t____ w____\nF__ b__');
  });

  it('preserves blank lines as blank lines', () => {
    expect(step3FirstLetters('hi\n\nbye')).toBe('h_\n\nb__');
  });

  it('keeps token length stable', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z ]{1,40}$/),
        (line) => step3FirstLetters(line).length === line.length,
      ),
    );
  });
});

describe('step4FirstLineLetters', () => {
  it('returns first letter of each line', () => {
    expect(step4FirstLineLetters('Hello there\nWorld how\nAre you')).toBe('H\nW\nA');
  });
});

describe('step2BionicStripped', () => {
  it('preserves whitespace and line breaks', () => {
    const out = step2BionicStripped('Hello world\nFoo bar');
    expect(out.split('\n')).toHaveLength(2);
  });

  it('keeps token length stable', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z ]{1,40}$/),
        (line) => step2BionicStripped(line).length === line.length,
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
